import ChatApplication from '@/components/chat-application';
import AutoModelBootstrap from '@/components/chat/auto-model-bootstrap';
import ImageAttachmentBridge from '@/components/chat/image-attachment-bridge';
import MobileChatChrome from '@/components/chat/mobile-chat-chrome';

export default function HomePage() {
  return (
    <>
      <AutoModelBootstrap />
      <MobileChatChrome />
      <ChatApplication />
      <ImageAttachmentBridge />
    </>
  );
}
