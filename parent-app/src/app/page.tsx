import { Page as AppPage } from '@/components/app-page'
import Image from 'next/image'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-2 bg-gray-100 flex items-center">
        <Image
          src="/icon_parent_2.svg"
          alt="Teddy Talk Icon"
          width={350}
          height={100}
          className="mr-4"
        />
      </header>
      <main className="flex-grow">
        <AppPage />
      </main>
      <footer className="p-4 bg-gray-100 text-center">
        <p>&copy; 2024 Teddy Talk Console</p>
      </footer>
    </div>
  );
}
