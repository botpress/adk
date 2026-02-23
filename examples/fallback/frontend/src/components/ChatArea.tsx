import {
  Composer,
  Container,
  MessageList,
  StylesheetProvider,
} from '@botpress/webchat'
import { IoMdAddCircleOutline } from 'react-icons/io'
import type { ScopedClient, BlockMessage } from '@botpress/webchat'

const BOT_CONFIG = {
  name: 'Fallback Bot',
  avatar: '',
  description: 'Flight API fallback demo.',
}

const SUGGESTIONS = [
  'What flights are available?',
  'Look up flight FL001',
  'Search flights from CDG to AUS',
]

interface ChatAreaProps {
  client: ScopedClient | undefined
  messages: BlockMessage[]
  isTyping: boolean
  clientState: string
  newConversation: () => void
  user: { userId: string } | undefined
}

export function ChatArea({ client, messages, isTyping, clientState, newConversation, user }: ChatAreaProps) {
  const isLoading = clientState === 'connecting' || clientState === 'disconnected'
  const hasMessages = messages.length > 0

  const enrichedMessages = messages.map((message) => {
    const direction = message.authorId === user?.userId ? 'outgoing' : 'incoming'
    return {
      ...message,
      direction,
      sender:
        direction === 'outgoing'
          ? { name: 'You', avatar: undefined }
          : { name: BOT_CONFIG.name, avatar: BOT_CONFIG.avatar },
    }
  })

  const sendMessage = async (payload: { type: 'text'; text: string }) => {
    if (!client) return
    try {
      await client.sendMessage(payload)
    } catch (e) {
      console.error('Failed to send message:', e)
    }
  }

  return (
    <main className="relative z-10 flex-1 h-screen min-w-0 flex flex-col overflow-hidden">
      <div
        className={`chat-wrapper ${isLoading ? 'is-loading' : hasMessages ? 'has-messages' : 'empty-state'}`}
        style={{ flex: 1, display: 'flex', position: 'relative', minWidth: 0 }}
      >
        <Container
          connected={clientState !== 'disconnected'}
          style={{ width: '100%', height: '100%', display: 'flex' }}
        >
          {/* New conversation button */}
          <button onClick={() => newConversation()} className="restart-button">
            <IoMdAddCircleOutline style={{ width: 14, height: 14 }} />
            New
          </button>

          {/* Loading spinner */}
          {isLoading && (
            <div className="loading-spinner">
              <div className="spinner" />
            </div>
          )}

          {/* Empty state */}
          <div className="empty-state-title">
            <h1>Fallback Demo</h1>
            <p className="empty-state-description">
              Test flight API fallback behavior. Toggle endpoints in the sidebar to see how the agent handles failures.
            </p>
          </div>

          {/* Suggestion buttons */}
          <div className="suggestion-buttons">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="suggestion-button"
                onClick={() => sendMessage({ type: 'text', text: s })}
              >
                {s}
              </button>
            ))}
          </div>

          <MessageList
            botName={BOT_CONFIG.name}
            botDescription={BOT_CONFIG.description}
            isTyping={isTyping}
            showMessageStatus={true}
            showMarquee={false}
            messages={enrichedMessages}
            sendMessage={sendMessage}
          />

          <Composer
            disableComposer={false}
            isReadOnly={false}
            allowFileUpload={false}
            connected={clientState !== 'disconnected'}
            sendMessage={sendMessage}
            composerPlaceholder="Ask about flights…"
          />
        </Container>

        {/* Footer */}
        <div className="composer-footer-text">
          <span>
            Fallback Demo built on the Botpress ADK.{' '}
            <a
              href="https://github.com/botpress/adk/tree/main/examples/fallback"
              target="_blank"
              rel="noopener noreferrer"
            >
              View source
            </a>
          </span>
        </div>

        <StylesheetProvider
          radius={1.5}
          fontFamily="Inter"
          variant="solid"
          color="#667eea"
        />
      </div>
    </main>
  )
}
