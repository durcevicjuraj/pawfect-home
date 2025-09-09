import { Link } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { PawPrint, Heart, Shield, Smile, ArrowRight } from "lucide-react";
import "./index.css";
import logo from "./assets/logo.png";

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-dvh bg-base-200">
      <div className="max-w-6xl mx-auto p-6 space-y-10">

        {/* Hero */}
        <div className="hero bg-base-100 rounded-box shadow">
          <div className="hero-content text-center">
            <div className="max-w-2xl">
              <div className="flex justify-center mb-3">
                  <img src={logo} alt="Pawfect Home" className="w-24 h-24" />                
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold">
                Find a pawfect home — adopt, don’t shop
              </h1>
              <p className="mt-3 opacity-80">
                Pawfect Home connects people with animals who need loving families.
                Browse real adoption listings from our community and shelters, and
                reach out directly to the poster.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 justify-center">
                <Link to="/listings" className="btn btn-primary">
                  Browse listings <ArrowRight size={18} />
                </Link>
                {user && (
                  <Link to="/listings/new" className="btn btn-outline">
                    Create a listing
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Why adoption matters */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Why adoption matters</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <Heart className="opacity-70" />
                <h3 className="card-title">Save a life</h3>
                <p className="opacity-80">
                  Every adoption opens space for another animal in need.
                </p>
              </div>
            </div>
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <Shield className="opacity-70" />
                <h3 className="card-title">Ethical choice</h3>
                <p className="opacity-80">
                  Support humane care and reduce demand for unethical breeding.
                </p>
              </div>
            </div>
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <Smile className="opacity-70" />
                <h3 className="card-title">Real companionship</h3>
                <p className="opacity-80">
                  Adopted pets are grateful, loving, and often already socialized.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section>
          <h2 className="text-2xl font-bold mb-4">How it works</h2>
          <ul className="steps steps-vertical sm:steps-horizontal">
            <li className="step step-primary">Browse pets</li>
            <li className="step">Open listing</li>
            <li className="step">Contact</li>
            <li className="step">Meet & adopt</li>
          </ul>
        </section>


      </div>
    </div>
  );
}
