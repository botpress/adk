import { useState } from 'react'
import { useWebchat } from '@botpress/webchat'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import './App.css'

const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || ""

function App() {
  const { client, messages, isTyping, clientState, newConversation, user } =
    useWebchat({ clientId: CLIENT_ID })

  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex w-screen h-screen overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-500/50 to-[#17A0BF] z-0" />

      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((o) => !o)} />

      <ChatArea
        client={client}
        messages={messages}
        isTyping={isTyping}
        clientState={clientState}
        newConversation={newConversation}
        user={user}
      />
    </div>
  )
}

export default App
