import { type FC } from "react";
import type { ResearchData, ResearchStep } from "../types/research";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "./ui/drawer";

type Props = {
  data: ResearchData;
  isOpen: boolean;
  onClose: () => void;
};

const ResearchDrawer: FC<Props> = ({ data, isOpen, onClose }) => {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };
  const renderStep = (step: ResearchStep, index: number) => {
    const getStepIcon = () => {
      if (step.status === 'pending') return '⏸️';
      if (step.status === 'in_progress') return '⏳';
      if (step.status === 'error') return '❌';
      return '✅';
    };

    const getStepTitle = () => {
      switch (step.type) {
        case 'search':
          return 'Search';
        case 'readPage':
          return 'Reading Page';
        case 'writing':
          return 'Writing';
        case 'pending':
          return 'Pending';
        default:
          return 'Step';
      }
    };

    return (
      <div
        key={index}
        className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2 border border-gray-200 dark:border-gray-700"
      >
        {/* Step Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">{getStepIcon()}</span>
          <span className="font-semibold text-sm">
            {getStepTitle()}
          </span>
        </div>

        {/* Step-specific content */}
        {step.type === 'search' && (
          <div className="mb-2">
            <div className="text-xs opacity-70 mb-1">
              Search terms:
            </div>
            <div className="flex flex-wrap gap-1">
              {step.searches.map((term, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded"
                >
                  {term}
                </span>
              ))}
            </div>
          </div>
        )}

        {step.type === 'readPage' && (
          <div className="mb-2">
            <div className="flex items-center gap-1.5">
              {step.favicon && (
                <img
                  src={step.favicon}
                  alt=""
                  className="w-4 h-4"
                />
              )}
              <a
                href={step.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline break-all"
              >
                {step.url}
              </a>
            </div>
            {step.error && (
              <div className="mt-1 text-xs text-red-500">
                Error: {step.error}
              </div>
            )}
          </div>
        )}

        {step.type === 'writing' && (
          <div className="mb-2">
            <div className="text-xs opacity-70">
              Section: <strong>{step.section}</strong>
            </div>
            {step.error && (
              <div className="mt-1 text-xs text-red-500">
                Error: {step.error}
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {step.preview && (
          <div className="text-xs italic opacity-80 pl-2 border-l-2 border-gray-300 dark:border-gray-600">
            {step.preview}
          </div>
        )}
      </div>
    );
  };

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[96vh]">
        <DrawerHeader>
          <DrawerTitle>{data.title}</DrawerTitle>
          <DrawerDescription>{data.topic}</DrawerDescription>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between mb-1.5 text-xs text-gray-600 dark:text-gray-400">
              <span>Progress</span>
              <span>{data.progress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  data.status === 'errored'
                    ? 'bg-red-500'
                    : data.status === 'done'
                    ? 'bg-green-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${data.progress}%` }}
              />
            </div>
          </div>

          {/* Meta info */}
          <div className="mt-3 flex gap-4 text-xs text-gray-600 dark:text-gray-400">
            <span>Started: {new Date(data.startedAt).toLocaleString()}</span>
            <span>Status: {data.status}</span>
          </div>
        </DrawerHeader>

        {/* Content */}
        <div className="px-4 pb-4 overflow-y-auto">
          {/* Steps */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3">
              Research Steps
            </h3>
            {data.steps.map((step, index) => renderStep(step, index))}
          </div>

          {/* Sources */}
          {data.sources.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3">
                Sources ({data.sources.length})
              </h3>
              {data.sources.map((source, index) => (
                <div
                  key={index}
                  className="p-2 bg-gray-50 dark:bg-gray-800 rounded mb-1.5 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center gap-2">
                    {source.favicon && (
                      <img
                        src={source.favicon}
                        alt=""
                        className="w-4 h-4"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {source.title}
                      </div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-600 dark:text-gray-400 hover:underline truncate block"
                      >
                        {source.url}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Result */}
          {data.result && data.status === 'done' && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3">
                Final Report
              </h3>
              <a
                href={data.result}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-blue-500 text-white text-center rounded-lg font-medium text-sm hover:bg-blue-600 transition"
              >
                View Report →
              </a>
            </div>
          )}

          {/* Error */}
          {data.error && data.status === 'errored' && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              <strong>Error:</strong> {data.error}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ResearchDrawer;
