import ChatApplication from '@/components/chat-application';
import MobileChatChrome from '@/components/chat/mobile-chat-chrome';

export default function HomePage() {
  return (
    <>
      <MobileChatChrome />
      <ChatApplication />
    </>
  );
}
