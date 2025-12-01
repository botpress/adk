import {
  Container,
  Header,
  MessageList,
  Composer,
  useWebchat,
  StylesheetProvider,
} from "@botpress/webchat";
import type { IntegrationMessage } from "@botpress/webchat";
import TextRenderer from "./components/TextRenderer";
import CustomTextRenderer from "./components/CustomTextRenderer";
import { BOT_CONFIG, CLIENT_ID } from "./config/constants";
import { useEnrichedMessages } from "./hooks/useEnrichedMessages";
import { useSubAgentGroups } from "./hooks/useSubAgentGroups";
import { SubAgentProvider } from "./context/SubAgentContext";
import "./App.css";

function App() {
  const { client, messages, isTyping, user, clientState, newConversation } =
    useWebchat({
      clientId: CLIENT_ID,
    });

  const enrichedMessages = useEnrichedMessages(messages, user?.userId);
  const subAgentGroups = useSubAgentGroups(messages);

  const sendMessage = async (payload: IntegrationMessage["payload"]) => {
    if (!client) return;

    try {
      await client.sendMessage(payload);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <SubAgentProvider groups={subAgentGroups}>
      <Container
        connected={clientState !== "disconnected"}
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
        }}
      >
        <Header
          defaultOpen={false}
          restartConversation={newConversation}
          disabled={false}
          configuration={{
            botName: BOT_CONFIG.name,
            botAvatar: BOT_CONFIG.avatar,
            botDescription: BOT_CONFIG.description,
          }}
        />
        <MessageList
          botName={BOT_CONFIG.name}
          botDescription={BOT_CONFIG.description}
          isTyping={isTyping}
          showMessageStatus={true}
          showMarquee={true}
          messages={enrichedMessages}
          sendMessage={sendMessage}
          renderers={{
            bubble: TextRenderer,
            custom: CustomTextRenderer,
          }}
        />
        <Composer
          disableComposer={false}
          isReadOnly={false}
          allowFileUpload={false}
          connected={clientState !== "disconnected"}
          sendMessage={sendMessage}
          composerPlaceholder="Ask a question..."
        />
      </Container>
      <StylesheetProvider
        radius={1.5}
        fontFamily="Inter"
        variant="solid"
        color="#0090FF"
      />
    </SubAgentProvider>
  );
}

export default App;
