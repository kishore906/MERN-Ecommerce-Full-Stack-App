import "./App.css";
import { BrowserRouter, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Footer from "./components/layout/Footer";
import Header from "./components/layout/Header";

import useUserRoutes from "./components/routes/userRoutes";
import useAdminRoutes from "./components/routes/adminRoutes";

function App() {
  // we are using 'all routes' as react elements here using useUserRoutes() & useAdminRoutes()
  const userRoutes = useUserRoutes();
  const adminRoutes = useAdminRoutes();

  return (
    <BrowserRouter>
      <div className="App">
        <Toaster position="top-center" />
        <Header />

        <div className="container">
          <Routes>
            {userRoutes}
            {adminRoutes}
          </Routes>
        </div>

        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
