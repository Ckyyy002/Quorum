import { CircleCheck } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ErrorText } from '@/features/org/org-forms';
import { checkInErrorMessage, useCheckIn } from './meeting-api';

/**
 * US-7.1: where the QR's link lands. The member confirms with a button instead of an automatic POST, so a
 * page reload (or React StrictMode's double effect) never sends a second check-in.
 */
export function CheckInPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const checkIn = useCheckIn(id);

  return (
    <section className="flex max-w-md flex-col gap-4">
      <h1 className="text-3xl font-bold tracking-tight">Presensi rapat</h1>
      {checkIn.isSuccess ? (
        <p className="flex items-center gap-2 rounded-xl bg-success/15 p-4 font-semibold text-success">
          <CircleCheck className="size-5" aria-hidden="true" /> Kehadiranmu sudah tercatat.
        </p>
      ) : !token ? (
        <ErrorText>Link presensi tidak lengkap. Pindai ulang QR di layar penyelenggara.</ErrorText>
      ) : (
        <>
          <p className="text-muted-foreground">Tekan tombol di bawah untuk mencatat kehadiranmu.</p>
          <Button
            className="self-start"
            disabled={checkIn.isPending}
            onClick={() => checkIn.mutate(token)}
          >
            {checkIn.isPending ? 'Mencatat…' : 'Konfirmasi hadir'}
          </Button>
          {checkIn.isError && <ErrorText>{checkInErrorMessage(checkIn.error)}</ErrorText>}
        </>
      )}
      <Link to={`/rapat/${id}`} className="text-sm text-primary hover:underline">
        Lihat detail rapat
      </Link>
    </section>
  );
}
