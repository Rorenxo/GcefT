"use client"

import { useState } from "react"
import { Input } from "@/shared/components/ui/input"
import { Eye, EyeOff } from "lucide-react"

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function PasswordInput({ label, ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative">
      {label && (
        <label htmlFor={props.id} className="block text-sm font-medium text-zinc-900 mb-1">
          {label}
        </label>
      )}
      <Input
        {...props}
        type={showPassword ? "text" : "password"}
        className="border-zinc-800 bg-zinc-100 text-black pr-10"
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-black"
        tabIndex={-1}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
