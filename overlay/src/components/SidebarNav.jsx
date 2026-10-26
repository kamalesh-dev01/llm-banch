export default function SidebarNav({ tabs, activeTab, onTabChange }) {
  return (
    <div className="w-36 bg-[#0a0a10] border-r border-[#1e1e28]
                    flex flex-col py-4 flex-shrink-0">
      <div className="px-4 mb-6">
        <span className="text-xs font-bold text-[#3a6aaa]
                         tracking-widest uppercase">
          LLM Bench
        </span>
      </div>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`text-left px-4 py-2.5 text-sm transition
                      cursor-pointer font-medium ${
            activeTab === tab.id
              ? 'bg-[#1e2a4a] text-[#6baee0] border-r-2 border-[#3a6aaa]'
              : 'text-[#6a6a72] hover:text-[#e0dfd6] hover:bg-[#13131a]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
