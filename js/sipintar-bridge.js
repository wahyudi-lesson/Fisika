/**
 * Si-PINTAR Bridge (js/sipintar-bridge.js)
 * Penghubung otomatis antara Portal Utama Si-PINTAR dengan seluruh modul
 * (Media/Tutor AI, Simulasi, LKPD Interaktif, Uji Kompetensi, dan Dashboard).
 */
(function () {
    // Deteksi lokasi script ini agar pemanggilan ../css/sipintar-theme.css akurat di kedalaman folder mana pun
    const currentScriptSrc = document.currentScript ? document.currentScript.src : window.location.href;

    // 1. BACA PARAMETER KONTEKS DARI URL PORTAL
    const params = new URLSearchParams(window.location.search);
    const initialTheme = params.get('theme') || localStorage.getItem('sipintar_theme') || 'dark';

    window.SIPINTAR_CTX = {
        nisn: params.get('nisn') || '',
        nama: params.get('nama') || '',
        kelas: params.get('kelas') || '',
        tapel: params.get('tapel') || '2026/2027',
        sekolah: params.get('sekolah') || '',
        sheetId: params.get('sheetId') || '',
        kategori: params.get('kategori') || '',
        sub: params.get('sub') || '',
        theme: initialTheme
    };

    // 2. TERAPKAN TEMA GELAP/TERANG & SUNTIKKAN CSS SERAGAM SEBELUM RENDER
    document.documentElement.setAttribute('data-theme', initialTheme);
    try {
        const themeCssUrl = new URL('../css/sipintar-theme.css', currentScriptSrc).href;
        const themeLink = document.createElement('link');
        themeLink.rel = 'stylesheet';
        themeLink.href = themeCssUrl;
        document.head.appendChild(themeLink);
    } catch (e) {
        console.warn('Gagal memuat sipintar-theme.css:', e);
    }

    // Dengarkan perubahan tema secara real-time saat tombol Dark/Light Mode di Portal diklik
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SIPINTAR_THEME_CHANGE') {
            window.SIPINTAR_CTX.theme = event.data.theme;
            document.documentElement.setAttribute('data-theme', event.data.theme);
        }
    });

    // 3. HELPER PENGIRIMAN SKOR DENGAN ANTREAN OFFLINE (OFFLINE SYNC QUEUE)
    const QUEUE_KEY = 'sipintar_pending_scores';

    window.sipintarSendScore = async function (scriptUrl, payload, statusEl) {
        const enrichedPayload = {
            ...payload,
            sheetId: payload.sheetId || window.SIPINTAR_CTX.sheetId || '',
            nisn: payload.nisn || window.SIPINTAR_CTX.nisn || '-',
            kelas: payload.kelas || window.SIPINTAR_CTX.kelas || payload.playerSchool || '-',
            tapel: payload.tapel || window.SIPINTAR_CTX.tapel || '2026/2027',
            sekolah: payload.sekolah || window.SIPINTAR_CTX.sekolah || '-'
        };

        try {
            const response = await fetch(scriptUrl, {
                method: 'POST',
                body: JSON.stringify(enrichedPayload)
            });
            const result = await response.json();

            if (result.status === 'success') {
                if (statusEl) {
                    statusEl.innerText = '✅ Nilai & identitas berhasil tersimpan ke database!';
                    statusEl.style.color = '#10b981';
                }
                // Beri tahu Portal Utama bahwa Uji Kompetensi selesai
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                        type: 'SIPINTAR_ACTIVITY_DONE',
                        score: enrichedPayload.score
                    }, '*');
                }
                return { ok: true, result };
            }
            throw new Error(result.message || 'Respon server tidak valid');
        } catch (err) {
            // Simpan ke antrean lokal jika sinyal terputus
            const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
            queue.push({ scriptUrl, payload: enrichedPayload, savedAt: new Date().toISOString() });
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

            if (statusEl) {
                statusEl.innerText = '📴 Koneksi terputus. Nilai diamankan di HP & akan terkirim otomatis saat online!';
                statusEl.style.color = '#f59e0b';
            }
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: 'SIPINTAR_ACTIVITY_DONE',
                    score: enrichedPayload.score
                }, '*');
            }
            return { ok: false, offlineQueued: true };
        }
    };

    async function flushOfflineScoreQueue() {
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        if (queue.length === 0 || !navigator.onLine) return;

        const remaining = [];
        for (const item of queue) {
            try {
                const res = await fetch(item.scriptUrl, {
                    method: 'POST',
                    body: JSON.stringify(item.payload)
                });
                const json = await res.json();
                if (json.status !== 'success') remaining.push(item);
            } catch (e) {
                remaining.push(item);
            }
        }
        localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    }

    window.addEventListener('online', flushOfflineScoreQueue);

    // 4. INISIALISASI DOM (AUTO-FILL IDENTITAS, AUTO-SAVE LKPD, & KATEX)
    window.addEventListener('DOMContentLoaded', () => {
        const ctx = window.SIPINTAR_CTX;
        flushOfflineScoreQueue();

        // --- A. Auto-Fill Identitas Siswa ---
        if (ctx.nama) {
            const nameFields = [
                document.getElementById('player-name'),
                document.querySelector('input[name="nama"]')
            ];
            nameFields.forEach((el) => {
                if (el) {
                    el.value = ctx.nama;
                    el.readOnly = true;
                    el.style.opacity = '0.85';
                }
            });
        }

        if (ctx.kelas || ctx.sekolah) {
            // Untuk Halaman Uji Kompetensi (PGK, Benar/Salah, LitNum)
            const elSchoolQuiz = document.getElementById('player-school');
            if (elSchoolQuiz) {
                const infoParts = [ctx.kelas, ctx.sekolah].filter(Boolean).join(' - ');
                elSchoolQuiz.value = ctx.tapel ? `${infoParts} (${ctx.tapel})` : infoParts;
                elSchoolQuiz.readOnly = true;
                elSchoolQuiz.style.opacity = '0.85';
            }

            // Untuk Halaman LKPD Interaktif
            const elKelasLkpd = document.querySelector('input[name="kelas"]');
            if (elKelasLkpd && ctx.kelas) {
                elKelasLkpd.value = ctx.kelas;
                elKelasLkpd.readOnly = true;
                elKelasLkpd.style.opacity = '0.85';
            }

            const elSekolahLkpd = document.querySelector('input[name="sekolah"]');
            if (elSekolahLkpd && ctx.sekolah) {
                elSekolahLkpd.value = ctx.tapel ? `${ctx.sekolah} (TP ${ctx.tapel})` : ctx.sekolah;
                elSekolahLkpd.readOnly = true;
                elSekolahLkpd.style.opacity = '0.85';
            }
        }

        // --- B. Auto-Save Draf Form LKPD ---
        const lkpdForm = document.getElementById('lkpdForm');
        if (lkpdForm) {
            const draftKey = `sipintar_draft_${ctx.nisn || 'guest'}_${window.location.pathname}`;
            const savedDraft = JSON.parse(localStorage.getItem(draftKey) || '{}');

            // Pulihkan seluruh isian (input, textarea, select, radio, checkbox)
            Array.from(lkpdForm.elements).forEach((el) => {
                if (!el.name || el.readOnly) return;
                if (el.type === 'radio') {
                    if (savedDraft[el.name] === el.value) el.checked = true;
                } else if (el.type === 'checkbox') {
                    if (Array.isArray(savedDraft[el.name])) {
                        el.checked = savedDraft[el.name].includes(el.value);
                    }
                } else if (savedDraft[el.name] !== undefined) {
                    el.value = savedDraft[el.name];
                }
            });

            // Buat bilah indikator melayang + tombol Reset Draf
            const statusBar = document.createElement('div');
            statusBar.style.cssText = [
                'position:fixed', 'bottom:12px', 'right:12px', 'z-index:999',
                'background:rgba(15,23,42,0.92)', 'color:#34d399',
                'border:1px solid #059669', 'padding:6px 12px',
                'border-radius:10px', 'font-size:11px', 'font-weight:600',
                'display:flex', 'align-items:center', 'gap:10px',
                'box-shadow:0 4px 12px rgba(0,0,0,0.3)', 'backdrop-filter:blur(4px)'
            ].join(';');

            const statusText = document.createElement('span');
            statusText.textContent = '✓ Auto-Save Draf Aktif';

            const resetBtn = document.createElement('button');
            resetBtn.type = 'button';
            resetBtn.textContent = 'Reset';
            resetBtn.style.cssText = 'background:#ef4444;color:#fff;border:none;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;min-width:auto;flex:none;';
            resetBtn.onclick = () => {
                if (confirm('Hapus semua draf jawaban di halaman LKPD ini?')) {
                    localStorage.removeItem(draftKey);
                    lkpdForm.reset();
                    // Isi ulang identitas otomatis setelah form di-reset
                    window.location.reload();
                }
            };

            statusBar.appendChild(statusText);
            statusBar.appendChild(resetBtn);
            document.body.appendChild(statusBar);

            const saveFormState = () => {
                const snapshot = {};
                Array.from(lkpdForm.elements).forEach((el) => {
                    if (!el.name || el.readOnly) return;
                    if (el.type === 'radio') {
                        if (el.checked) snapshot[el.name] = el.value;
                    } else if (el.type === 'checkbox') {
                        if (!snapshot[el.name]) snapshot[el.name] = [];
                        if (el.checked) snapshot[el.name].push(el.value);
                    } else {
                        snapshot[el.name] = el.value;
                    }
                });
                localStorage.setItem(draftKey, JSON.stringify(snapshot));
                statusText.textContent = '✓ Draf tersimpan otomatis';
            };

            lkpdForm.addEventListener('input', saveFormState);
            lkpdForm.addEventListener('change', saveFormState);

            // Kirim sinyal selesai ke Portal saat LKPD di-export ke PDF
            lkpdForm.addEventListener('submit', () => {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                        type: 'SIPINTAR_ACTIVITY_DONE',
                        score: 'LKPD PDF'
                    }, '*');
                }
            });
        }

        // --- C. Renderer Matematika KaTeX Otomatis ---
        if (document.body.innerHTML.includes('$') && !window.renderMathInElement) {
            const katexCss = document.createElement('link');
            katexCss.rel = 'stylesheet';
            katexCss.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
            document.head.appendChild(katexCss);

            const katexJs = document.createElement('script');
            katexJs.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
            katexJs.onload = () => {
                const autoRender = document.createElement('script');
                autoRender.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js';
                autoRender.onload = () => {
                    window.renderMathInElement(document.body, {
                        delimiters: [
                            { left: '$$', right: '$$', display: true },
                            { left: '$', right: '$', display: false }
                        ],
                        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'input', 'select', 'option']
                    });
                };
                document.head.appendChild(autoRender);
            };
            document.head.appendChild(katexJs);
        }
    });
})();
