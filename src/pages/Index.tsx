import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ChatContainer from "@/components/Chat/ChatContainer";
import { chatStore } from "@/lib/chatStore";
import { auth, db } from "@/lib/firebase";
import { ref, get, child } from 'firebase/database';
// RTDB hydration is handled in AppShell via chatStore.hydrateFromCloud()

const Index = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      if (location.pathname === "/") {
        // Not logged in? Go to login.
        if (!auth.currentUser) {
          navigate('/login', { replace: true });
          return;
        }
  // If logged in and no profile in RTDB, send to onboarding (do not create chat)
        const user = auth.currentUser;
        if (user) {
          try {
            const snap = await get(child(ref(db), `users/${user.uid}/profile`));
            if (!snap.exists()) {
              navigate('/onboarding', { replace: true });
              return;
            }
          } catch (e) {
            console.warn('Profile check failed', e);
          }
        }
        const chat = chatStore.create();
        navigate(`/chat/${chat.id}`, { replace: true });
      }
    })();
  }, [location.pathname, navigate]);

  return <ChatContainer />;
};

export default Index;
