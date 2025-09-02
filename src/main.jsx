import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Profile from "./pages/ProfileSettings.jsx";
import UserProfile from "./pages/UserProfile.jsx";
import Layout from "./components/AppLayout.jsx";
import Listings from "./pages/Listings.jsx";
import NewListing from "./pages/NewListing.jsx";
import ListingDetail from "./pages/ListingDetail.jsx";
import EditListing from "./pages/EditListing.jsx";

function ProtectedLayout() {
  const { user } = useAuth();
  if (user === undefined) return <div className="p-6">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* All signed-in pages share the right-side navbar via Layout */}
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<App />} />
            <Route path="/listings" element={<Listings />} />
            <Route path="/listings/new" element={<NewListing />} />
            <Route path="/profileSettings" element={<Profile />} />
            <Route path="/u/:uid" element={<UserProfile />} />
            <Route path="/listings/:id" element={<ListingDetail />} />  
            <Route path="/listings/:id/edit" element={<EditListing />} />
          </Route>

          {/* Public pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
