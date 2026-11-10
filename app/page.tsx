import ChatApplication from '@/components/chat-application';
import AutoModelBootstrap from '@/components/chat/auto-model-bootstrap';
import MobileChatChrome from '@/components/chat/mobile-chat-chrome';

export default function HomePage() {
  return (
    <>
      <AutoModelBootstrap />
      <MobileChatChrome />
      <ChatApplication />
    </>
  );
}
