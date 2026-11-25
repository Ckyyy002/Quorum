# Prompt: UI/UX design Quorum di Figma

> Tempel seluruh blok di bawah ke Claude yang terhubung ke Figma.
> Token warna dan font diambil dari CSS https://hmtc-its.com/ (diambil 2026-11-24).

---

Kamu adalah product designer senior. Buatkan desain UI/UX di Figma untuk **Quorum**, web app internal
untuk menjalankan operasional himpunan mahasiswa HMTC ITS (Kabinet Niat Baik 2026/2027). Identitas visual
harus mengikuti website resmi himpunan, https://hmtc-its.com/. Sesuaikan gayanya untuk aplikasi kerja
yang padat data, bukan landing page.

## 1. Tentang produk
Quorum menjalankan satu periode kepengurusan: struktur organisasi (periode → kesekjenan → departemen → biro),
program kerja (proker) dengan checklist sesuai tipenya, task, alur persetujuan proposal/LPJ
(Draft → In Review → Reviewed → Approved → At Kaprodi → Signed → Archived, dengan jalur Revision),
rapat dengan agenda/notulen, serta absensi QR. Semua copy UI memakai **Bahasa Indonesia**.

Role (diambil dari jabatan di periode aktif): Admin, Ketua, Sekjen Bidang (Pengembangan/Relasi/Personalia),
Sekjen Administrasi, Sekjen Keuangan, Kadep/Sekdep, Kabiro/Wakabiro, Staff, dan PIC per proker. Ada juga dua role di luar
kepengurusan: **Guest** (sudah daftar, belum terverifikasi) dan **Mahasiswa TC** (diverifikasi Admin dengan
NRP + angkatan) yang hanya melihat layanan publik departemen, tidak pernah proker/task/dokumen/rapat.
Tombol yang tidak boleh dipakai sebuah role disembunyikan.

## 2. Design tokens (wajib, buat sebagai Figma Variables)
Nama variabel mengikuti shadcn/ui, karena implementasinya memakai React + Tailwind v4 + shadcn/ui.

| Token | Light | Sumber di hmtc-its.com |
| --- | --- | --- |
| background | #F5F1EA | `--color-background` (krem khas situs) |
| foreground | #101A21 | `--color-foreground` |
| card / popover | #FFFFFF | `--color-card` |
| primary | #186BEC | `--color-primary` |
| primary-foreground | #FFFFFF | |
| secondary | #F2CB00 | `--color-secondary` (kuning) |
| secondary-foreground | #101A21 | |
| accent | #E1F5FF | `--color-accent` |
| muted | #E0EDF8 | `--color-muted` |
| muted-foreground | #457B9F | `--color-muted-foreground` |
| border / input | #D0E5F4 | `--color-border` |
| ring | #186BEC | |
| destructive | #D2001E | `--color-destructive` |
| navy (sidebar, header gelap) | #01263C | `--color-navy` |
| french-blue | #0076C0 | `--color-french-blue` |
| cerulean | #00AAE7 | `--color-cerulean-blue` |
| orange (warning/late) | #F56F1C | `--color-orange-main` |
| success | #439F6E | `--color-text-success` |
| warning | #FFB82E | `--color-text-validation` |
| dark section | #121212 | dipakai untuk section gelap di situs |
| cream text on dark | #FDFAF0 | `--color-white-main` |

Mode gelap: buat juga variabel dark (background #01263C/#121212, card #0A2F47, teks #FDFAF0,
border white/10%). Pastikan kontras teks minimal WCAG AA (4.5:1).

Radius: sm 3px, md 6px, **lg 8px (default komponen)**, xl 12px, 2xl 16px (kartu besar), full (badge/avatar).

Tipografi:
- UI dan body: **Plus Jakarta Sans** (dipakai di situs dan tersedia di Google Fonts). Skala:
  12/14/16/18/20/24/30/36, dengan weight 400/500/600/700.
- Display, khusus judul besar di login/empty state/hero dashboard: **Libre Caslon Text** (situs memakai
  Libre Caslon dan serif Adelphe untuk headline). Gunakan secukupnya.
- Angka/kode (nomor dokumen, token QR, tanggal H-): **JetBrains Mono**.
- Situs memakai headline uppercase besar, contohnya "MEMBAWA PERUBAHAN POSITIF & PROGRESIF". Pakai gaya
  ini hanya di login dan hero dashboard, bukan di layar kerja.

Ikon: Lucide (sesuai shadcn). Foto kegiatan asli boleh dipakai di login atau empty state; jangan pakai ilustrasi kartun.

## 3. Karakter visual
Formal, rapi, dan percaya diri. Latar krem hangat, aksen biru, dengan sentuhan kuning untuk highlight.
Navy dipakai untuk sidebar. Jaga spasi tetap lega, tapi tabel dan list harus tetap padat dan mudah dipindai.
Gunakan pola "angka besar di atas label" dari situs (misalnya "9 DEPARTEMEN") untuk kartu statistik dashboard.

Status dokumen dibedakan warna badge secara konsisten:
Draft = muted, In Review = cerulean, Reviewed = french-blue, Approved = primary, At Kaprodi = navy,
Signed = success, Archived = abu-abu, Revision = orange. Deadline terlambat ditandai orange dengan label "Terlambat".

## 4. Komponen (halaman "Components")
Buat komponen dengan variants dan auto layout:
Button (default/secondary/outline/ghost/destructive × sm/md/lg × state), Input, Select, Textarea,
Date picker, Checkbox, Badge status, Avatar, Card, Table (sort, pagination `{halaman, total}`),
Tabs, Dialog, Sheet, Toast, Empty state, Skeleton, Breadcrumb, Sidebar item, Stat card,
Timeline approval (item: aktor, jabatan, aksi, catatan, waktu), Checklist item (due date H-n, tick, terlambat),
Kanban card task, dan Upload dropzone (PDF, batas ukuran ditampilkan).

## 5. Layar (desktop 1440, plus versi mobile 390 untuk layar bertanda *)
App shell: sidebar navy (logo HMTC + "Quorum", menu sesuai role), header dengan pemilih periode aktif,
search global, notifikasi, dan menu profil.

Prioritas 1 (dibutuhkan paling cepat):
1. Login* (email + password, gaya hero situs: foto/latar gelap, headline serif besar)
2. Dashboard per role (stat cards, proker saya, task saya, deadline dokumen terdekat, rapat terdekat)
3. Admin: periode, kesekjenan → departemen → biro (tree), daftar anggota + form membership
   (field berubah sesuai jabatan)
4. Profil saya* (foto, nama, NRP, jabatan aktif)

Prioritas 2:
5. Daftar proker (filter tipe/status/departemen, search, pagination)
6. Detail proker: header (tipe, status, tanggal H, PIC, biro), tabs Ringkasan / Checklist / Task /
   Dokumen / Panitia / Rapat
7. Papan task (kanban TODO, IN_PROGRESS, DONE) + task saya*

Prioritas 3:
8. Dokumen proposal/LPJ: detail dengan stepper status, versi file, timeline approval, panel aksi sesuai role
   (Submit, Setujui administrasi, Setujui keuangan, Sahkan, Kembalikan dengan catatan wajib)
9. Tracker deadline dokumen (tabel lintas proker, H-21/H-18/H-15/H-14, highlight terlambat)

Prioritas 4:
10. Jadwal rapat + form buat rapat (tipe, undangan otomatis, agenda: topik, output, materi; alasan jika urgent)
11. Notulen: keputusan, next action (PIC + deadline → menjadi task), carry-over
12. Absensi QR: layar penyelenggara (QR besar yang berganti, counter hadir) dan layar scan anggota*

Prioritas 5 (layanan departemen, Should; kerjakan paling akhir dan cukup satu layar utama per layanan):
13. Guest: form pengajuan verifikasi Mahasiswa TC* + status (Pending/Disetujui/Ditolak + alasan);
    Admin: daftar pengajuan dengan aksi setujui/tolak
14. Beranda Mahasiswa TC*: lomba terbaru, kegiatan komunitas, acara IA, program SRD, merch, donasi aktif, aspirasi saya
15. Aspirasi SW*: form kirim (opsi anonim → tampilkan kode lacak), daftar publik dengan status dan tanggapan SW
16. Info lomba RT* (filter kategori/level/deadline) dan kegiatan komunitas STI
17. Katalog merch EDD* (harga jual, badge Tersedia / Hampir habis / Habis) + layar kasir penjualan untuk EDD
18. Donasi SSD*: halaman penggalangan dengan progress bar terkumpul vs target, form lapor donasi, laporan transparansi
19. Program SRD dan acara IA: daftar, detail, tombol daftar (kuota tersisa), progres kehadiran peserta
20. Request desain CMI: form request + kanban status (Diajukan → Diterima → Dikerjakan → Menunggu persetujuan → Selesai)
21. Rapor GDPF Personalia: form penilaian 360 (skala 1–5 per indikator) dan rapor semester per subnilai/aspek

Setiap layar data juga perlu state kosong, loading (skeleton), error, dan 403 "Kamu tidak punya akses".

## 6. Cara kerja
- Mulai dari halaman **Cover**, **Tokens** (variables + text styles), dan **Components**, baru kemudian layar.
- Kerjakan per prioritas. Setelah Prioritas 1 selesai, berhenti dan minta review saya sebelum lanjut.
- Pakai komponen dan variabel; hindari warna atau ukuran hard-coded.
- Pakai data contoh yang realistis: departemen SRD, SW, RT, STI, EDD, IA, EA, SSD, CMI; proker seperti
  "Bluecamp 2026", "TC Run", "Seminar Dosen"; nama orang Indonesia (fiktif).
- Logo: pakai placeholder bernama "Logo HMTC". Logo asli akan saya upload sendiri.
- Di akhir, tulis ringkasan keputusan desain (5 poin) dan daftar variabel yang perlu dipindah ke `index.css`.
