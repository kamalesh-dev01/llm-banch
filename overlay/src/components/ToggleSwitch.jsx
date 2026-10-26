export default function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full relative transition-colors
                  duration-200 cursor-pointer flex-shrink-0 ${
        checked ? 'bg-[#3a6aaa]' : 'bg-[#1e1e28]'
      }`}
    >
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full
                       shadow transition-all duration-200 ${
        checked ? 'left-5' : 'left-0.5'
      }`} />
    </button>
  )
}
