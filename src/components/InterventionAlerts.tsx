import { AlertTriangle, Clock } from "lucide-react";

interface Alert {
  id: number;
  name: string;
  risk: "High" | "Moderate" | "Low";
  subject: string;
  time: string;
}

const alerts: Alert[] = [
  {
    id: 1,
    name: "Juan dela Cruz",
    risk: "High",
    subject: "Numeracy",
    time: "2 hours ago",
  },
  {
    id: 2,
    name: "Ana Reyes",
    risk: "High",
    subject: "Reading",
    time: "3 hours ago",
  },
  {
    id: 3,
    name: "Carlos Mendoza",
    risk: "Moderate",
    subject: "Science",
    time: "5 hours ago",
  },
  {
    id: 4,
    name: "Elena Torres",
    risk: "Moderate",
    subject: "Numeracy",
    time: "1 day ago",
  },
  {
    id: 5,
    name: "Sofia Bautista",
    risk: "High",
    subject: "Reading",
    time: "1 day ago",
  },
];

const riskConfig = {
  High: {
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  Moderate: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    border: "border-yellow-200",
    dot: "bg-yellow-500",
  },
  Low: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
  },
};

export default function InterventionAlerts() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h3 className="text-base font-semibold text-gray-900">
            Intervention Alerts
          </h3>
        </div>
        <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
          {alerts.filter((a) => a.risk === "High").length} critical
        </span>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {alerts.map((alert) => {
          const config = riskConfig[alert.risk];
          return (
            <div
              key={alert.id}
              className={`flex items-center justify-between rounded-lg border ${config.border} ${config.bg} p-3 transition-all duration-150 hover:shadow-sm cursor-pointer`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 rounded-full ${config.dot} animate-pulse`}
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {alert.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {alert.risk} Risk • {alert.subject}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <Clock className="h-3 w-3" />
                <span className="text-[11px]">{alert.time}</span>
              </div>
            </div>
          );
        })}
      </div>

      <button className="mt-4 w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900">
        View All Interventions
      </button>
    </div>
  );
}
