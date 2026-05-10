import { useEffect, useState } from 'react';
import HeaderBar from '../components/HeaderBar';
import { getPetRoomData } from '../api';

export default function PetRoomPage() {
  const [pets, setPets] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    getPetRoomData()
      .then((data) => setPets(data.pets || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="ペットルーム" />
      {error && <div className="panel mb-4 p-5 text-sm text-rose-700">{error}</div>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pets.map((pet) => (
          <article key={pet.name} className="panel p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#eef8ff] text-4xl">{pet.emoji}</div>
              <div>
                <p className="display-font text-xl font-extrabold text-[#354172]">{pet.name}</p>
                <p className="text-sm font-bold text-[#6f7da8]">{pet.mood}</p>
              </div>
            </div>
            <div className="mt-4 rounded-[22px] bg-[#f8fbff] p-4 text-sm leading-6 text-[#6f7da8]">
              このペットは学習の進み具合に応じて育ちます。
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
