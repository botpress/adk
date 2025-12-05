import { type FC, useState } from "react";
import type { ResearchData, ResearchStep } from "../types/research";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "./ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";

type Props = {
  data: ResearchData;
  isOpen: boolean;
  onClose: () => void;
};

const ResearchSheet: FC<Props> = ({ data, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState("activity");

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
        className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg mb-3 border border-gray-200 dark:border-gray-700"
      >
        {/* Step Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">{getStepIcon()}</span>
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {getStepTitle()}
          </span>
        </div>

        {/* Step-specific content */}
        {step.type === 'search' && (
          <div className="mb-2">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              Search terms:
            </div>
            <div className="flex flex-wrap gap-1">
              {step.searches.map((term, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full"
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
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Section: <strong className="text-gray-900 dark:text-gray-100">{step.section}</strong>
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
          <div className="text-xs italic text-gray-600 dark:text-gray-400 pl-2 border-l-2 border-gray-300 dark:border-gray-600 mt-2">
            {step.preview}
          </div>
        )}
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        {/* Header with close button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <SheetHeader className="p-0">
            <SheetTitle className="text-base font-semibold">{data.title}</SheetTitle>
          </SheetHeader>
          <SheetClose className="rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-gray-100 dark:ring-offset-gray-950 dark:focus:ring-gray-300 dark:data-[state=open]:bg-gray-800">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
              <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
            </svg>
            <span className="sr-only">Close</span>
          </SheetClose>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-6 pt-4">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="sources">Sources</TabsTrigger>
            </TabsList>
          </div>

          {/* Activity Tab */}
          <TabsContent value="activity" className="flex-1 overflow-y-auto px-6 pb-6">
            {/* Topic */}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {data.topic}
            </p>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between mb-2 text-xs text-gray-600 dark:text-gray-400">
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
            <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-800">
              <div className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>Started:</span>
                  <span>{new Date(data.startedAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="capitalize">{data.status.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Research Steps
              </h3>
              {data.steps.map((step, index) => renderStep(step, index))}
            </div>

            {/* Result */}
            {data.result && data.status === 'done' && (
              <div className="mt-6">
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
              <div className="mt-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                <strong>Error:</strong> {data.error}
              </div>
            )}
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources" className="flex-1 overflow-y-auto px-6 pb-6">
            {data.sources.length > 0 ? (
              <div className="space-y-3">
                {data.sources.map((source, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
                    <div className="flex items-start gap-3">
                      {source.favicon && (
                        <img
                          src={source.favicon}
                          alt=""
                          className="w-5 h-5 mt-0.5 flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                          {source.title}
                        </div>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline break-all"
                        >
                          {source.url}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p className="text-sm">No sources yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default ResearchSheet;
