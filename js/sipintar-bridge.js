(function () {
    const params = new URLSearchParams(window.location.search);
    window.SIPINTAR_CTX = {
        nisn: params.get('nisn') || '',
        nama: params.get('nama') || '',
        kelas: params.get('kelas') || '',
        tapel: params.get('tapel') || '2026/2027',
        sekolah: params.get('sekolah') || '',
        sheetId: params.get('sheetId') || '',
        theme: params.get('theme') || 'dark'
    };

    window.addEventListener('DOMContentLoaded', () => {
        const ctx = window.SIPINTAR_CTX;

        // 1. Auto-Fill Identitas Siswa untuk Uji Kompetensi & LKPD
        if (ctx.nama) {
            const targetsNama = [document.getElementById('player-name'), document.querySelector('input[name="nama"]')];
            targetsNama.forEach(el => {
                if (el) { el.value = ctx.nama; el.readOnly = true; el.style.opacity = '0.85'; }
            });
        }

        if (ctx.kelas || ctx.sekolah) {
            const elSchoolQuiz = document.getElementById('player-school');
            if (elSchoolQuiz) {
                elSchoolQuiz.value = `${ctx.kelas} - ${ctx.sekolah} (${ctx.tapel})`;
                elSchoolQuiz.readOnly = true;
                elSchoolQuiz.style.opacity = '0.85';
            }

            const elKelasLkpd = document.querySelector('input[name="kelas"]');
            if (elKelasLkpd && ctx.kelas) { elKelasLkpd.value = ctx.kelas; elKelasLkpd.readOnly = true; }

            const elSekolahLkpd = document.querySelector('input[name="sekolah"]');
            if (elSekolahLkpd && ctx.sekolah) {
                elSekolahLkpd.value = `${ctx.sekolah} (TP ${ctx.tapel})`;
                elSekolahLkpd.readOnly = true;
            }
        }

        // 2. Auto-Save Draf LKPD (Jika halaman memuat form LKPD)
        const lkpdForm = document.getElementById('lkpdForm');
        if (lkpdForm) {
            const draftKey = `sipintar_draft_${ctx.nisn || 'guest'}_${window.location.pathname}`;
            const savedDraft = JSON.parse(localStorage.getItem(draftKey) || '{}');

            // Pulihkan draf sebelumnya
            Object.entries(savedDraft).forEach(([name, val]) => {
                const field = lkpdForm.querySelector(`[name="${name}"]`);
                if (!field || field.readOnly) return;
                if (field.type === 'radio') {
                    const radio = lkpdForm.querySelector(`[name="${name}"][value="${val}"]`);
                    if (radio) radio.checked = true;
                } else {
                    field.value = val;
                }
            });

            // Indikator status simpan otomatis
            const badge = document.createElement('div');
            badge.style.cssText = 'position:fixed;bottom:12px;right:12px;background:#0f172a;color:#34d399;border:1px solid #059669;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;z-index:999;box-shadow:0 4px 10px rgba(0,0,0,0.3);';
            badge.textContent = '✓ Auto-Save Draf LKPD Aktif';
            document.body.appendChild(badge);

            lkpdForm.addEventListener('input', () => {
                const formData = new FormData(lkpdForm);
                const obj = {};
                formData.forEach((v, k) => { obj[k] = v; });
                localStorage.setItem(draftKey, JSON.stringify(obj));
                badge.textContent = '✓ Draf tersimpan otomatis';
            });

            lkpdForm.addEventListener('submit', () => {
                window.parent.postMessage({ type: 'SIPINTAR_ACTIVITY_DONE', score: 'LKPD PDF' }, '*');
            });
        }

        // 3. Muat Renderer Matematika KaTeX Otomatis jika ada simbol '$'
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
                    renderMathInElement(document.body, {
                        delimiters: [
                            { left: '$$', right: '$$', display: true },
                            { left: '$', right: '$', display: false }
                        ]
                    });
                };
                document.head.appendChild(autoRender);
            };
            document.head.appendChild(katexJs);
        }
    });
})();
