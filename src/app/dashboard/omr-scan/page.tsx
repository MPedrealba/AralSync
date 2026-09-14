"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import OMRScanner from "@/components/OMRScanner";
import { Upload, Camera, X, ArrowRight } from "lucide-react";

/**
 * OMR Scan — the dedicated scan page. Their own route now (was the "New Scan"
 * tab on the OMR Assessments page). Landing on ?scan=1 (sidebar quick action)
 * opens the scanner dialog straight away; "Start Scanning" reopens it here too.
 */
function OMRScaenPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showOMR, setShowOMR] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Arriving from the sidebar "OMR Scan" action (?scan=1) → open scanner now.
  useEffect(() => {
    if (searchParams.get("scan") === "1") setShowOMR(true);
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  return (
    <>
      <Header title="OMR Scan" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        {/* Title + back link */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">OMR Scan</h1>
            <p className="mt-1 text-sm text-gray-500">
              Scan a student&apos;s bubble sheet to auto-score it and record the
              assessment.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/omr-assessments")}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:border-blue-200 hover:text-blue-600"
          >
            Results &amp; History
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Upload Area — 3/5 */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="mb-1 text-base font-semibold text-gray-900">
                Upload or Capture OMR Sheet
              </h3>
              <p className="mb-5 text-sm text-gray-400">
                Upload a scanned OMR sheet image or take a photo directly.
              </p>

              {!previewUrl ? (
                <>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 transition-colors hover:border-blue-500/40 hover:bg-blue-50/20">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                      <Upload className="h-6 w-6 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-700">
                      Click to upload or drag and drop
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      PNG, JPG or JPEG (max 10MB)
                    </p>
                  </label>

                  <div className="mt-5 flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                      <Upload className="h-4 w-4" />
                      Browse Files
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                      <Camera className="h-4 w-4" />
                      Use Camera
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-4 rounded-xl border border-blue-200 bg-slate-50 p-6">
                  <img
                    src={previewUrl}
                    alt="OMR Sheet Preview"
                    className="max-h-56 w-auto rounded-lg border border-blue-200 bg-slate-50 object-contain shadow-sm"
                  />
                  <p className="max-w-full truncate text-sm font-medium text-gray-700">
                    {selectedFile?.name}
                  </p>
                  <button
                    onClick={handleRemoveFile}
                    className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                    Remove / Retake
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Assessment Details — 2/5 */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="mb-5 text-base font-semibold text-gray-900">
                Assessment Details
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Assessment Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Diagnostic Test 1"
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Subject
                  </label>
                  <select className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                    <option>Select subject</option>
                    <option>Numeracy</option>
                    <option>Reading</option>
                    <option>Science</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Grade Level
                  </label>
                  <select className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                    <option>Select grade</option>
                    <option>Grade 7</option>
                    <option>Grade 8</option>
                    <option>Grade 9</option>
                    <option>Grade 10</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Section
                  </label>
                  <select className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                    <option>Select section</option>
                    <option>Rosal</option>
                    <option>Sampaguita</option>
                    <option>Ilang-Ilang</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => setShowOMR(true)}
                disabled={!selectedFile}
                className="mt-6 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Scanning
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* OMR Scanner Modal */}
      <OMRScanner isOpen={showOMR} onClose={() => setShowOMR(false)} />
    </>
  );
}

export default function OMRScaenPage() {
  return (
    <Suspense fallback={null}>
      <OMRScaenPageContent />
    </Suspense>
  );
}