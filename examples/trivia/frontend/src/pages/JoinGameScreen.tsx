import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sparkles } from "lucide-react"
import { getWebchatClient } from "@/lib/webchat"
import { initAudio } from "@/lib/sounds"
import adkLogo from "@/assets/ADK.svg"

const CODE_LENGTH = 4

export function JoinGameScreen() {
  const navigate = useNavigate()
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""))
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [username, setUsername] = useState("")
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [, setIsSavingUsername] = useState(false)

  // Fetch existing username on mount
  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const { client } = await getWebchatClient()
        const { user } = await client.getUser()
        if (user.name) {
          setUsername(user.name)
        }
      } catch (error) {
        console.error("[JoinGameScreen] Failed to fetch user:", error)
      } finally {
        setIsLoadingUser(false)
      }
    }
    fetchUsername()
  }, [])

  // Save username when it changes (debounced)
  useEffect(() => {
    if (isLoadingUser || !username.trim()) return

    const timeoutId = setTimeout(async () => {
      setIsSavingUsername(true)
      try {
        const { client } = await getWebchatClient()
        await client.updateUser({ name: username.trim() })
        console.log("[JoinGameScreen] Username saved:", username.trim())
      } catch (error) {
        console.error("[JoinGameScreen] Failed to save username:", error)
      } finally {
        setIsSavingUsername(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [username, isLoadingUser])

  const handleCodeChange = (index: number, value: string) => {
    // Take only the first character and convert to uppercase
    const char = value.slice(0, 1).toUpperCase()

    // Only accept alphanumeric characters
    if (/^[A-Z0-9]$/.test(char) || char === "") {
      const newCode = [...code]
      newCode[index] = char
      setCode(newCode)

      // Auto-focus next input
      if (char && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus()
      }
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "")

    if (pastedText.length > 0) {
      const newCode = [...code]
      for (let i = 0; i < Math.min(pastedText.length, CODE_LENGTH); i++) {
        newCode[i] = pastedText[i]
      }
      setCode(newCode)

      // Focus the next empty input or the last one
      const nextEmptyIndex = newCode.findIndex((c) => c === "")
      const focusIndex = nextEmptyIndex === -1 ? CODE_LENGTH - 1 : nextEmptyIndex
      inputRefs.current[focusIndex]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleJoinGame = () => {
    const gameCode = code.join("")
    if (gameCode.length === CODE_LENGTH) {
      console.log("[trivia] Joining game with code:", gameCode)
      // Initialize audio on user interaction (required for mobile browsers)
      initAudio()
      // Navigate to lobby to join via hidden conversation
      navigate(`/lobby?join=${gameCode}`)
    }
  }

  const handleCreateGame = () => {
    console.log("[trivia] Creating new game")
    // Initialize audio on user interaction (required for mobile browsers)
    initAudio()
    // Navigate to lobby to create via hidden conversation
    navigate("/lobby?action=create")
  }

  const isCodeComplete = code.every((digit) => digit !== "")
  const isUsernameValid = username.trim().length >= 2
  const canJoin = isCodeComplete && isUsernameValid
  const canCreate = isUsernameValid

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md space-y-8 flex-1 flex flex-col justify-center">
        {/* Logo and Title */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <a href="https://botpress.com/docs/for-developers/adk/overview" target="_blank" rel="noopener noreferrer">
              <img
                src={adkLogo}
                alt="Botpress ADK"
                className="h-20 w-auto opacity-30 grayscale dark:opacity-40 dark:invert hover:opacity-100 hover:grayscale-0 hover:scale-105 dark:hover:invert transition-all duration-200 cursor-pointer"
              />
            </a>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-balance text-gray-900 dark:text-white">
            Trivia Quiz
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Test your knowledge and compete with friends
          </p>
        </div>

        {/* Main Card */}
        <Card className="p-8 space-y-8 shadow-lg">
          {/* Username Section */}
          <div className="space-y-3">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Your Name
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              disabled={isLoadingUser}
              className="w-full px-4 py-3 text-lg rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
            />
            {!isUsernameValid && username.length > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Name must be at least 2 characters
              </p>
            )}
          </div>

          {/* Join by Code Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-center text-balance text-gray-900 dark:text-white">
              Join by code
            </h2>
            <div className="flex gap-3 justify-center">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="w-16 h-16 text-center text-2xl font-bold rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all uppercase"
                  aria-label={`Code character ${index + 1}`}
                />
              ))}
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={handleJoinGame}
              disabled={!canJoin}
            >
              Join Game
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-medium">
                OR
              </span>
            </div>
          </div>

          {/* Create Game Section */}
          <div className="space-y-4">
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={handleCreateGame}
              disabled={!canCreate}
            >
              <Sparkles className="w-5 h-5" />
              Create New Game
            </Button>
          </div>
        </Card>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          <span>
            Demo built on{" "}
            <a
              href="https://botpress.com/docs/for-developers/adk/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Botpress ADK
            </a>
            {" · "}
            <a
              href="https://github.com/botpress/adk/tree/main/examples/trivia"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              View source
            </a>
          </span>
        </p>
      </footer>
    </main>
  )
}
