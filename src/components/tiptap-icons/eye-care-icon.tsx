import { memo } from "react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

export const EyeCareIcon = memo(({ className, ...props }: SvgProps) => {
  return (
    <svg
      width="24"
      height="24"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M2.4 12C4.38 8.55 7.86 6.5 12 6.5C16.14 6.5 19.62 8.55 21.6 12C19.62 15.45 16.14 17.5 12 17.5C7.86 17.5 4.38 15.45 2.4 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.75"
        fill="currentColor"
      />
      <path
        d="M15.9 4.2C16.08 3.21 16.88 2.43 17.88 2.27C17.05 3.02 16.98 4.27 17.73 5.1C18.48 5.93 19.73 6 20.56 5.25C20.4 6.25 19.62 7.05 18.63 7.23C17.22 7.49 15.87 6.56 15.61 5.15C15.55 4.83 15.55 4.52 15.9 4.2Z"
        fill="currentColor"
      />
    </svg>
  )
})

EyeCareIcon.displayName = "EyeCareIcon"
