const stats = [
  {
    title: "総プロジェクト数",
    value: "24",
    change: "+12%",
    changeType: "increase" as const,
    icon: "📊",
  },
  {
    title: "アクティブユーザー",
    value: "1,234",
    change: "+23%",
    changeType: "increase" as const,
    icon: "👥",
  },
  {
    title: "今月の売上",
    value: "¥2,480,000",
    change: "+8%",
    changeType: "increase" as const,
    icon: "💰",
  },
  {
    title: "システム稼働率",
    value: "99.9%",
    change: "-0.1%",
    changeType: "decrease" as const,
    icon: "⚡",
  },
];

export function DashboardStats() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <div
          key={stat.title}
          className="bg-white rounded-lg p-5 md:p-6 lg:p-7 shadow-sm border border-gray-200 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex flex-col gap-4 items-start">
            {/* アイコンとタイトル */}
            <div className="flex flex-row items-center gap-3">
              <span className="text-2xl">{stat.icon}</span>
              <h3 className="text-sm font-medium text-gray-600 leading-tight">{stat.title}</h3>
            </div>

            {/* 値と変化率 */}
            <div className="flex flex-col gap-2 items-start">
              <p className="text-2xl font-bold text-gray-900 leading-none">{stat.value}</p>
              <div className="flex flex-row items-center gap-1">
                <span
                  className={`text-xs font-medium ${stat.changeType === "increase" ? "text-green-600 bg-green-100" : "text-red-600 bg-red-100"} px-1.5 py-0.5 rounded-full`}
                >
                  {stat.changeType === "increase" ? "↗" : "↘"} {stat.change}
                </span>
                <span className="text-xs text-gray-500">前月比</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
