import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SelfSignup from "./pages/SelfSignup";
import NotFound from "./pages/NotFound";

// Standalone public self-signup portal, one link per gym:
// https://join.fitrobit.com/<gym-username>
const App = () => (
  <TooltipProvider>
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/:username" element={<SelfSignup />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
