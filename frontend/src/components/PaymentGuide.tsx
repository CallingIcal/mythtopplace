import { useState } from 'react';
import qrisReal from '../assets/qris.jpeg';
import qrisDemo from '../assets/qris-demo.svg';
import type { Payment } from '../types';
import { money } from '../ui';

// Build demo (VITE_MOCK) memakai gambar contoh agar QRIS asli tidak ikut ke situs demo publik.
const qris = import.meta.env.VITE_MOCK ? qrisDemo : qrisReal;

export const WARNING = 'JIKA PEMBAYARAN YANG DILAKUKAN TIDAK SESUAI DENGAN NOMINAL YANG ADA MAKA ADMIN BERHAK MENDISKUALIFIKASI PEMBELIAN YANG ADA.';

export const CHECK_WARNING = 'Periksa kembali ID atau username game dan nominal sebelum membayar. Kesalahan pengiriman akibat data yang salah tidak ditanggung admin.';
export const CheckWarning = () => <p className="alert" role="alert"><strong>CEK DATA SEBELUM MEMBAYAR:</strong> {CHECK_WARNING}</p>;

export const PaymentWarning = () => <p className="alert" role="alert"><strong>PERINGATAN:</strong> {WARNING}</p>;

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* abaikan */ }
  };
  return <button type="button" className="btn ghost sm" onClick={copy}>{done ? 'Tersalin' : 'Salin'}</button>;
}

const stepsFor = (m: Payment): string[] => {
  const proof = 'Simpan bukti (screenshot atau nomor referensi), lalu kirim di halaman Riwayat dan tekan "Saya sudah bayar".';
  if (m.kind === 'qris') return ['Buka aplikasi m-banking atau e-wallet yang mendukung QRIS.', 'Pilih Scan atau Bayar, lalu scan kode QRIS di atas.', 'Masukkan nominal persis sesuai total pembayaran.', 'Selesaikan pembayaran.', proof];
  if (m.kind === 'bank') return [`Buka m-banking atau ATM, pilih transfer ke ${m.bankName}.`, 'Masukkan nomor rekening di atas dan pastikan nama penerima sesuai.', 'Transfer persis sesuai total pembayaran.', proof];
  return [`Buka aplikasi ${m.name}, pilih Kirim, lalu masukkan nomor di atas.`, 'Kirim persis sesuai total pembayaran.', proof];
};

export function PaymentGuide({ method, total }: { method: Payment; total: number }) {
  return (
    <div className="guide">
      <strong>Panduan pembayaran {method.name}</strong>
      {method.kind === 'qris' && <img className="qris" src={qris} alt="Kode QRIS untuk pembayaran" />}
      {method.kind !== 'qris' && (
        <dl className="acct">
          {method.kind === 'bank' && <><dt>Bank</dt><dd>{method.bankName}</dd></>}
          {method.accountName && <><dt>Atas nama</dt><dd>{method.accountName}</dd></>}
          <dt>{method.kind === 'bank' ? 'No. rekening' : `Nomor ${method.name}`}</dt>
          <dd>{method.accountNumber ?? 'Belum diatur'} {method.accountNumber && <CopyButton text={method.accountNumber} />}</dd>
        </dl>
      )}
      <ol>{stepsFor(method).map((s) => <li key={s}>{s}</li>)}</ol>
      <p className="total">Nominal yang harus dibayar: <strong>{money(total)}</strong></p>
    </div>
  );
}
