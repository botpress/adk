import { useState, useRef, type KeyboardEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sparkles, Trophy, Users } from "lucide-react"

export function JoinGameScreen() {
  const navigate = useNavigate()
  const [code, setCode] = useState(["", "", "", ""])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value[0]
    }

    if (/^[0-9]$/.test(value) || value === "") {
      const newCode = [...code]
      newCode[index] = value
      setCode(newCode)

      // Auto-focus next input
      if (value && index < 3) {
        inputRefs.current[index + 1]?.focus()
      }
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleJoinGame = () => {
    const gameCode = code.join("")
    if (gameCode.length === 4) {
      console.log("[trivia] Joining game with code:", gameCode)
      // Navigate to lobby to join via hidden conversation
      navigate(`/lobby?join=${gameCode}`)
    }
  }

  const handleCreateGame = () => {
    console.log("[trivia] Creating new game")
    // Navigate to lobby to create via hidden conversation
    navigate("/lobby?action=create")
  }

  const isCodeComplete = code.every((digit) => digit !== "")

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <div className="text-6xl">🎯</div>
            </div>
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-balance text-gray-900 dark:text-white">
            Trivia Quiz
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Test your knowledge and compete with friends
          </p>
        </div>

        {/* Main Card */}
        <Card className="p-8 space-y-8 shadow-lg">
          {/* Join by Code Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-center text-balance text-gray-900 dark:text-white">
              Join by code
            </h2>
            <div className="flex gap-3 justify-center">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-16 h-16 text-center text-2xl font-bold rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  aria-label={`Code digit ${index + 1}`}
                />
              ))}
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={handleJoinGame}
              disabled={!isCodeComplete}
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
            >
              <Sparkles className="w-5 h-5" />
              Create New Game
            </Button>
          </div>
        </Card>

        {/* Feature Pills */}
        <div className="flex flex-wrap gap-3 justify-center">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
            <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Multiplayer</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
            <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Real-time Scoring</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
            <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">Fun Categories</span>
          </div>
        </div>
      </div>
    </main>
  )
}
