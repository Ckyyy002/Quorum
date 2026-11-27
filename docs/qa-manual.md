# Panduan QA manual Quorum

Tujuan: klik setiap flow Must di browser per role sebelum rekam video demo. Centang `[x]` saat lolos;
tulis bug di bagian **Temuan** paling bawah (langkah, hasil yang diharapkan, hasil sebenarnya).

Aturan main: setiap role diuji dua sisi, **yang boleh** (tombol ada dan berhasil) dan **yang tidak boleh**
(tombol tidak muncul, dan kalau URL dibuka langsung hasilnya 403/kosong, bukan crash).

## 0. Persiapan

```bash
pnpm dev                                   # compose, migrate, seed, API + web
pnpm --filter api db:seed --with-structure # periode 2026/2027 + 9 departemen + Biro Personalia
```
- Web: http://localhost:5173 · Mailpit: http://localhost:8025 · Swagger: http://localhost:3000/api/docs
- Pakai dua browser (atau satu biasa + satu incognito) supaya bisa login dua role sekaligus.
- Siapkan file uji: 1 PDF kecil, 1 JPG, 1 DOCX, dan 1 file > 10 MB (untuk uji 413).

### Akun uji
Daftar lewat `/register` (password sama semua, mis. `Quorum123!`), lalu Admin memberi jabatan di
**Anggota & jabatan**. Pakai departemen **STI** (Kesekjenan Pengembangan) dan buat satu biro di dalamnya.

| Akun | Jabatan yang diberikan Admin |
| --- | --- |
| `qa-ketua@quorum.test` | KETUA |
| `qa-sbid@quorum.test` | SEKJEN_BIDANG, kesekjenan Pengembangan |
| `qa-adm@quorum.test` | SEKJEN_ADMINISTRASI_1, cover Pengembangan |
| `qa-keu@quorum.test` | SEKJEN_KEUANGAN_1, cover Pengembangan |
| `qa-kadep@quorum.test` | KEPALA_DEPARTEMEN STI |
| `qa-sekdep@quorum.test` | SEKRETARIS_DEPARTEMEN STI |
| `qa-kabiro@quorum.test` | KEPALA_BIRO, biro di STI |
| `qa-staff1@quorum.test` | STAFF, biro yang sama (nanti dijadikan PIC) |
| `qa-staff2@quorum.test` | STAFF, biro yang sama (anggota panitia / assignee) |
| `qa-luar@quorum.test` | KEPALA_DEPARTEMEN **RT** (untuk uji "departemen lain" → 403) |
| `qa-guest@quorum.test` | tanpa jabatan |

## 1. Auth (semua akun)
- [ ] Register akun baru; email duplikat ditolak dengan pesan jelas
- [ ] Login salah password → pesan error, tidak bocor "email tidak terdaftar"
- [ ] Refresh halaman setelah login → tetap login (refresh token cookie)
- [ ] Biarkan > 15 menit lalu klik sesuatu → tetap jalan (access token diperbarui otomatis)
- [ ] Logout → kembali ke `/login`; tombol Back tidak membuka halaman terproteksi
- [ ] Buka `/rapat/xxx/hadir?t=...` saat belum login → setelah login kembali ke URL itu
- [ ] `/profil`: ubah nama, upload foto (JPG), foto muncul di header; file > 2 MB / PDF ditolak

## 2. Admin
- [ ] Menu "Struktur organisasi" dan "Anggota & jabatan" muncul; tidak muncul untuk akun lain
- [ ] Akun non-admin buka `/admin/struktur` langsung → tampilan 403
- [ ] Struktur: tambah, ganti nama, hapus kesekjenan; tambah departemen dan biro
- [ ] Anggota: beri jabatan ke semua akun uji di tabel atas; Sekjen Bidang wajib pilih kesekjenan
- [ ] Jabatan tunggal (mis. KETUA kedua) ditolak dengan pesan 409
- [ ] Akhiri jabatan seseorang → tugas terbukanya jadi tanpa assignee, dia keluar dari panitia

## 3. Kadep / Sekdep (STI)
Proker
- [ ] Menu: Dashboard, Proker, Tugasku, Rapat, Dokumen, Tracker, Departemenku
- [ ] `/proker/baru`: buat proker **PROYEK_BESAR** dengan tanggal acara ±30 hari lagi
- [ ] Detail: set biro pelaksana + PIC (`qa-staff1`) → email "ditunjuk PIC" masuk Mailpit
- [ ] Checklist muncul sesuai tipe (WBS, presentasi BPH H-35/H-25, dst.) dengan tanggal jatuh tempo
- [ ] Centang item checklist → wajib link/file bukti; batal centang; edit item
- [ ] Ubah tanggal acara → tanggal checklist dan deadline dokumen ikut bergeser
- [ ] Ubah status proker
- [ ] Panitia: isi Sekben + Kadiv (nama divisi wajib); PIC tidak bisa dipilih lagi sebagai panitia
- [ ] Buat proker kedua bertipe **AGENDA_MENENGAH** dengan tanggal acara **kemarin** (untuk uji LPJ)

Tugas
- [ ] Buat tugas di board proker, assign `qa-staff2` → email masuk; deadline wajib
- [ ] Geser kartu (drag-and-drop) dan pakai tombol langkah; DONE wajib bukti
- [ ] Tugas lewat deadline tampil sebagai terlambat

Dokumen (proposal)
- [ ] Kartu "Proposal & LPJ" di detail proker → buat draft proposal (anggaran, sumber dana, file PDF)
- [ ] Submit tanpa file / anggaran 0 → ditolak dengan pesan jelas
- [ ] Hapus Sekben dari panitia lalu submit → 409 "panitia belum lengkap"; isi lagi lalu submit
- [ ] Tandai "diskusi Kaprodi" (H-21) sebagai sudah dilakukan
- [ ] Setelah Ketua mengesahkan (lihat §6): tandai "dikirim ke Kaprodi" → upload PDF bertanda tangan → arsipkan
- [ ] Linimasa (timeline) dan daftar versi tampil lengkap

LPJ
- [ ] Pada proker AGENDA_MENENGAH (tanggal acara kemarin): buat LPJ, anggaran 0 boleh, submit berhasil
- [ ] Pada proker PROYEK_BESAR (acara belum lewat): submit LPJ ditolak

Rapat
- [ ] `/rapat/baru`: tipe yang tersedia hanya DEPARTEMEN dan PROKER
- [ ] Rapat < 24 jam lagi tanpa "urgent" ditolak; dengan urgent + alasan berhasil
- [ ] Jadwalkan rapat DEPARTEMEN besok → email undangan masuk ke anggota STI
- [ ] Reschedule dan batalkan rapat lain → email pembaruan/pembatalan
- [ ] Isi notulensi (keputusan, next action dengan PIC + deadline, carried-over) → next action jadi tugas
- [ ] Notulensi > 24 jam setelah rapat selesai ditandai terlambat

Larangan
- [ ] Buka proker milik departemen RT (dibuat `qa-luar`) → tidak ada tombol edit/assign/checklist
- [ ] Tidak ada tombol review/pengesahan di dokumen sendiri

## 4. Kabiro (biro pelaksana)
- [ ] Menu "Biroku" menampilkan proker yang dieksekusi biro
- [ ] Boleh: edit detail proker, ubah status, centang checklist, kelola tugas, buat draft dokumen
- [ ] Tidak boleh: buat proker, ganti PIC/biro, atur panitia, **submit** dokumen (tombol tidak ada)
- [ ] `/rapat/baru`: hanya tipe BIRO; jadwalkan rapat biro

## 5. PIC (`qa-staff1`) dan Staff (`qa-staff2`)
PIC
- [ ] Bisa: edit proker, ubah status, centang checklist, atur panitia, kelola tugas, draft dokumen
- [ ] Tidak bisa: submit dokumen, buat proker baru
- [ ] `/rapat/baru`: hanya tipe PROKER; undangan = panitia proker

Staff
- [ ] `/tugas` (Tugasku) menampilkan tugas yang di-assign
- [ ] Ubah status tugas sendiri; DONE wajib bukti; tidak bisa ubah tugas orang lain
- [ ] Detail proker: tidak ada tombol edit/checklist/panitia
- [ ] Menu "Tracker" tidak muncul; `/tracker` langsung → 403
- [ ] `/rapat/baru` tidak tersedia / tidak ada tipe yang bisa dipilih

## 6. Sekjen Administrasi & Sekjen Keuangan
- [ ] Dashboard "Perlu tindakanmu" memuat proposal STI yang IN_REVIEW
- [ ] Kembalikan (return) tanpa catatan → ditolak; dengan catatan → status REVISION, email ke Sekdep
- [ ] Sekdep edit + submit ulang → kembali IN_REVIEW
- [ ] Adm setujui saja → masih IN_REVIEW; Keu setujui juga → REVIEWED
- [ ] Adm: bisa mengarsipkan dokumen SIGNED; Keu tidak bisa
- [ ] Dokumen departemen RT (kesekjenan Relasi, tidak di-cover) → tidak ada tombol review
- [ ] Tracker menampilkan proker kesekjenan yang di-cover
- [ ] Bisa menjadwalkan rapat BPH dan KABINET

## 7. Ketua
- [ ] Dokumen REVIEWED → tombol Pengesahan → APPROVED; atau return dengan catatan
- [ ] Bisa edit detail proker mana pun, tapi **tidak** bisa ubah status proker
- [ ] Tracker dan dashboard organisasi menampilkan semua departemen
- [ ] Melihat semua rapat; bisa jadwalkan BPH dan KABINET (undangan default benar)

## 8. Sekjen Bidang (Pengembangan)
- [ ] Menu "Kesekjenanku" berisi departemen Pengembangan saja
- [ ] Tracker hanya kesekjenan sendiri; dokumen draft departemennya terlihat, tapi tanpa tombol review
- [ ] Bisa jadwalkan rapat KESEKJENAN (undangan: seluruh elemen departemennya), BPH, KABINET
- [ ] Proker departemen Relasi → hanya ringkasan/lihat, tanpa aksi

## 9. Absensi QR (organizer + undangan)
- [ ] Organizer buka absensi > 30 menit sebelum mulai → ditolak; ≤ 30 menit → QR muncul
- [ ] QR berganti tiap ±30 detik
- [ ] Scan dengan HP (HP satu jaringan, buka web via IP laptop) sebagai undangan → halaman konfirmasi →
      klik konfirmasi → tercatat hadir
- [ ] Pakai QR lama (> 60 detik) → ditolak "token kedaluwarsa"
- [ ] Akun yang tidak diundang scan → ditolak
- [ ] Tandai manual (izin/absen) menimpa check-in QR; rekap kehadiran benar
- [ ] Tutup absensi → scan berikutnya ditolak; rapat dibatalkan → tandai manual ditolak

## 10. Guest (`qa-guest`)
- [ ] Menu hanya Dashboard, Proker, profil; tidak ada Tugasku/Rapat/Dokumen/Tracker
- [ ] Daftar proker tampil ringkas; buka detail proker → tidak ada data internal (403/ringkasan saja)
- [ ] `/rapat`, `/tracker`, `/admin/anggota` langsung lewat URL → 403, tidak crash

## 11. Pencarian, upload, email, reminder
- [ ] `/proker` dan `/dokumen`: cari dengan `q` (salah ketik sedikit tetap ketemu), filter kesekjenan → departemen, rentang tanggal; pager jalan
- [ ] Upload file > 10 MB → pesan "terlalu besar" (413); file `.exe` diganti nama `.pdf` → ditolak
- [ ] Mailpit: setiap email punya subjek jelas, link mengarah ke halaman yang benar, tidak ada email ke pelaku sendiri
- [ ] Reminder: jalankan job manual (atau tunggu 07:00 WIB) → satu email digest per orang

## Temuan
| # | Role | Langkah | Diharapkan | Sebenarnya | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | | | | | |
