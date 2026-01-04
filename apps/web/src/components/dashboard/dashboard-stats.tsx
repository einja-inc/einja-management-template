import { css } from "../../../styled-system/css";
import { hstack, vstack } from "../../../styled-system/patterns";

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
    <div
      className={css({
        display: "grid",
        gridTemplateColumns: {
          base: "1fr",
          sm: "repeat(2, 1fr)",
          lg: "repeat(4, 1fr)",
        },
        gap: "1.5rem",
      })}
    >
      {stats.map((stat) => (
        <div
          key={stat.title}
          className={css({
            background: "white",
            borderRadius: "lg",
            padding: { base: "1.25rem", md: "1.5rem", lg: "1.75rem" },
            boxShadow: "sm",
            border: "1px solid {colors.gray.200}",
            transition: "all 0.2s",
            _hover: {
              boxShadow: "md",
              transform: "translateY(-2px)",
            },
          })}
        >
          <div className={vstack({ gap: "1rem", alignItems: "flex-start" })}>
            {/* アイコンとタイトル */}
            <div className={hstack({ gap: "0.75rem", alignItems: "center" })}>
              <span
                className={css({
                  fontSize: "1.5rem",
                })}
              >
                {stat.icon}
              </span>
              <h3
                className={css({
                  fontSize: "sm",
                  fontWeight: "medium",
                  color: "{colors.gray.600}",
                  lineHeight: "tight",
                })}
              >
                {stat.title}
              </h3>
            </div>

            {/* 値と変化率 */}
            <div className={vstack({ gap: "0.5rem", alignItems: "flex-start" })}>
              <p
                className={css({
                  fontSize: "2xl",
                  fontWeight: "bold",
                  color: "{colors.gray.900}",
                  lineHeight: "none",
                })}
              >
                {stat.value}
              </p>
              <div className={hstack({ gap: "0.25rem", alignItems: "center" })}>
                <span
                  className={css({
                    fontSize: "xs",
                    fontWeight: "medium",
                    color:
                      stat.changeType === "increase" ? "{colors.green.600}" : "{colors.red.600}",
                    background:
                      stat.changeType === "increase" ? "{colors.green.100}" : "{colors.red.100}",
                    padding: "0.125rem 0.375rem",
                    borderRadius: "full",
                  })}
                >
                  {stat.changeType === "increase" ? "↗" : "↘"} {stat.change}
                </span>
                <span
                  className={css({
                    fontSize: "xs",
                    color: "{colors.gray.500}",
                  })}
                >
                  前月比
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
