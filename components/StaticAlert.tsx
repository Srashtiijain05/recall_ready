"use client";

import { AlertCircle, CheckCircle, Info, Loader2, X } from "lucide-react";
import { ReactNode } from "react";

type AlertType = "error" | "success" | "info" | "loading";

interface StaticAlertProps {
  type: AlertType;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
}

export function StaticAlert({
  type,
  title,
  message,
  action,
  onDismiss,
}: StaticAlertProps) {
  const styles = {
    error: {
      container:
        "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
      icon: "text-red-500",
      title: "text-red-900 dark:text-red-100",
      message: "text-red-700 dark:text-red-300",
      button:
        "bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300",
    },
    success: {
      container:
        "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
      icon: "text-green-500",
      title: "text-green-900 dark:text-green-100",
      message: "text-green-700 dark:text-green-300",
      button:
        "bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-900/60 text-green-700 dark:text-green-300",
    },
    info: {
      container:
        "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
      icon: "text-blue-500",
      title: "text-blue-900 dark:text-blue-100",
      message: "text-blue-700 dark:text-blue-300",
      button:
        "bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300",
    },
    loading: {
      container:
        "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800",
      icon: "text-gray-500",
      title: "text-gray-900 dark:text-gray-100",
      message: "text-gray-700 dark:text-gray-300",
      button:
        "bg-gray-100 dark:bg-gray-900/40 hover:bg-gray-200 dark:hover:bg-gray-900/60 text-gray-700 dark:text-gray-300",
    },
  };

  const style = styles[type];
  const Icon =
    type === "error"
      ? AlertCircle
      : type === "success"
        ? CheckCircle
        : type === "loading"
          ? Loader2
          : Info;

  return (
    <div
      className={`p-4 border rounded-lg flex gap-3 ${style.container}`}
      role="alert"
    >
      <Icon
        size={20}
        className={`${style.icon} flex-shrink-0 ${type === "loading" ? "animate-spin" : ""}`}
      />
      <div className="flex-1 min-w-0">
        <h3 className={`font-medium text-sm ${style.title}`}>{title}</h3>
        {message && (
          <p className={`text-xs mt-1 ${style.message}`}>{message}</p>
        )}
        {action && (
          <button
            onClick={action.onClick}
            className={`text-xs px-3 py-1 rounded mt-2 transition-colors ${style.button}`}
          >
            {action.label}
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

interface FormAlertProps {
  message: string;
  type?: AlertType;
}

export function FormAlert({ message, type = "error" }: FormAlertProps) {
  return <StaticAlert type={type} title={message} />;
}

export default StaticAlert;
