import Navbar from '../component/Navbar';
import Footer from '../component/Footer';
import Hero from '../component/Hero';
import '../App.css'; // optional, only if Home needs it

function Home() {
  return (
    <div className="Home">
      <Navbar />
      <main className='content'>
        <Hero />
      </main>
      <Footer />
    </div>
  );
}

export default Home;