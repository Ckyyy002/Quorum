# Panduan Starter Kit Claude Code — Quorum

Kit ini membuat Claude Code langsung paham konteks Quorum, bekerja dengan alur yang konsisten, dan
terhubung ke GitHub Project. File ini hanya untuk kamu; boleh dihapus dari repo setelah setup selesai.

## Isi kit
| File | Fungsi |
| --- | --- |
| `CLAUDE.md` | "Prompt" permanen yang otomatis dibaca Claude Code setiap sesi: konteks, stack, aturan arsitektur, Definition of Done |
| `docs/context/progress.md` | Status terkini (sprint, story, coverage, langkah berikutnya). Ikut dimuat otomatis lewat `CLAUDE.md` |
| `docs/context/product.md`, `architecture.md`, `data-model.md` | Detail yang dibaca hanya saat dibutuhkan, supaya hemat token |
| `docs/adr/` | Catatan keputusan desain (bahan presentasi juga) |
| `.claude/skills/story` | `/story <nomor-issue>`: kerjakan satu user story dari rencana sampai PR |
| `.claude/skills/context-sync` | `/context-sync`: perbarui `docs/context/` setelah ada perubahan kode |
| `.claude/skills/gh-project` | `/gh-project`: baca dan pindahkan item di board GitHub Project |
| `.claude/skills/sprint-status` | `/sprint-status`: laporan progres terhadap tenggat 21 Desember |
| `.claude/settings.json` | Izin perintah yang aman supaya Claude tidak terus bertanya; `.env` diblokir |
| `scripts/bootstrap-github.sh` | Sekali jalan: buat label, milestone Sprint 0–3, dan issue untuk semua user story |

## Kenapa hemat dan selalu paham konteks
- `CLAUDE.md` dibuat ringkas; detail dipecah ke `docs/context/` dan hanya dibaca bila relevan.
- `progress.md` selalu diperbarui oleh `/context-sync`, jadi sesi baru tidak perlu menjelajah seluruh kode.
- Skill berisi langkah baku, jadi kamu cukup mengetik `/story 5` alih-alih menjelaskan ulang alurnya.

## Setup (sekitar 15 menit)
1. **Buat repo** di GitHub (mis. `quorum`), clone, lalu salin seluruh isi kit ini ke root repo.
2. **Buat GitHub Project** (template *Board*) dari profilmu. Di field **Status**, buat kolom:
   `Backlog`, `Todo`, `In Progress`, `In Review`, `Done`.
   Di menu *Workflows* project, aktifkan **Item closed → Done** dan **Pull request merged → Done**.
3. **Login gh dengan scope project**:
   ```bash
   gh auth login
   gh auth refresh -s project
   ```
4. **Hubungkan kit ke board** (owner = username GitHub, nomor dari URL project):
   ```bash
   chmod +x .claude/skills/gh-project/scripts/gh-project.sh scripts/bootstrap-github.sh
   bash .claude/skills/gh-project/scripts/gh-project.sh init <username> <nomor-project>
   ```
   Perintah ini membuat `.claude/github-project.json`. File itu hanya berisi ID, aman untuk di-commit.
5. **Isi board dengan semua story**:
   ```bash
   bash scripts/bootstrap-github.sh            # cek dulu (dry run)
   bash scripts/bootstrap-github.sh --apply    # buat sungguhan
   ```
6. Commit semuanya: `git add . && git commit -m "chore: add Claude Code context kit" && git push`.

## Prompt pertama di Claude Code
Buka terminal di root repo, jalankan `claude`, lalu tempel:

```
Baca CLAUDE.md dan docs/context/. Kita mulai Sprint 0.
Kerjakan issue "chore: scaffold monorepo, docker compose and CI" dengan skill story.
Sebelum menulis kode, tunjukkan rencanamu: struktur folder, isi docker-compose,
konfigurasi lint/test, dan isi workflow CI. Tunggu persetujuanku.
```

Setelah itu, alur hariannya:
| Situasi | Ketik |
| --- | --- |
| Mulai hari kerja | `/sprint-status` |
| Mengerjakan story | `/story <nomor-issue>` |
| Selesai sesi atau setelah merge | `/context-sync` |
| Cek atau ubah board | `/gh-project` (atau minta langsung: "pindahkan #7 ke In Review") |
| Keputusan desain baru | "buat ADR untuk keputusan ini" |

## Tips
- Satu sesi Claude Code = satu story. Setelah PR dibuat, jalankan `/clear` sebelum story berikutnya
  supaya konteks bersih; konteks penting sudah tersimpan di `docs/context/`.
- Minta Claude menjelaskan bagian yang belum kamu pahami sebelum lanjut, karena kamu harus bisa
  menjelaskan hampir semua baris di video.
- Kalau ada perubahan rencana (story dicoret, desain berubah), minta Claude mencatatnya di
  `progress.md` bagian *Deviations* dan, bila perlu, sebagai ADR.
