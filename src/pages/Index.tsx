import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ChatContainer from "@/features/chat/components/ChatContainer/ChatContainer";
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
      if (location.pathname === "/" || location.pathname === "/app") {
        // Not logged in? Go to login.
        if (!auth.currentUser) {
          navigate('/login', { replace: true });
          return;
        }
        // Hydrate from cloud first if we have user and no cached chats yet.
        let list = chatStore.list();
        if (auth.currentUser && list.length === 0) {
          try { await chatStore.hydrateFromCloud(); } catch (e) { /* ignore */ }
          list = chatStore.list();
        }
        if (list.length > 0) {
          navigate(`/chat/${list[0].id}`, { replace: true });
        } else {
          const c = chatStore.create();
          navigate(`/chat/${c.id}`, { replace: true });
        }
      }
    })();
  }, [location.pathname, navigate]);

  // Note: Fallback handling for a missing chatId is done inside ChatContainer.
  // Keeping it in one place prevents double-redirects and URL loops when a new
  // ephemeral chat (empty) isn't yet included in filtered chat lists.

  return (
    <>
      {/* React 19: Native document metadata */}
      <title>{chatId ? 'Chat' : 'Home'} | Ojas AI</title>
      <meta name="description" content="Your intelligent AI assistant for health, productivity, and daily tasks. Chat with Ojas AI." />
      
      <ChatContainer />
    </>
  );
};

export default Index;
