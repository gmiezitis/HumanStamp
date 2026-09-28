'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertCircle } from 'lucide-react';

interface CompareViewProps {
  version1: { id: string; versionNumber: number; filename: string; storageKey: string | null };
  version2: { id: string; versionNumber: number; filename: string; storageKey: string | null };
  comparisonData: {
    changedSpans: Array<{ start: number; end: number }>;
    overallSimilarity: number;
  } | null;
  duration: number;
}

export function CompareView({ version1, version2, comparisonData, duration }: CompareViewProps) {
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = percentage * duration;

    if (video1Ref.current) video1Ref.current.currentTime = seekTime;
    if (video2Ref.current) video2Ref.current.currentTime = seekTime;
  };

  const handleSpanClick = (start: number) => {
    if (video1Ref.current) video1Ref.current.currentTime = start;
    if (video2Ref.current) video2Ref.current.currentTime = start;
  };

  if (!comparisonData || !comparisonData.changedSpans) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Video Players */}
      {version1.storageKey && version2.storageKey && (
        <Card>
          <CardHeader>
            <CardTitle>Video Comparison</CardTitle>
            <CardDescription>Click timeline or changed spans to seek both videos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-2">Version {version2.versionNumber}</p>
                <video
                  ref={video1Ref}
                  controls
                  className="w-full rounded border"
                  src={`/api/storage/${version2.storageKey}`}
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Version {version1.versionNumber}</p>
                <video
                  ref={video2Ref}
                  controls
                  className="w-full rounded border"
                  src={`/api/storage/${version1.storageKey}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Changed Spans */}
      {comparisonData.changedSpans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Changed Time Spans
            </CardTitle>
            <CardDescription>
              Segments that differ between the two versions
            </CardDescription>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-2 rounded">
              <AlertCircle className="h-3 w-3" />
              <span>Visual changes only; audio differences are not detected</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative bg-muted rounded-lg p-4 mb-4">
              <div 
                className="relative h-12 bg-background rounded overflow-hidden cursor-pointer"
                onClick={handleTimelineClick}
              >
                {comparisonData.changedSpans.map((span, i) => {
                  const left = (span.start / duration) * 100;
                  const width = ((span.end - span.start) / duration) * 100;
                  return (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 bg-red-500/70 hover:bg-red-500 transition-colors"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                      }}
                      title={`${span.start.toFixed(1)}s - ${span.end.toFixed(1)}s`}
                    />
                  );
                })}
                <div className="absolute inset-0 flex items-center justify-between px-2 text-xs text-muted-foreground pointer-events-none">
                  <span>0s</span>
                  <span>{duration.toFixed(1)}s</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Click timeline to seek both videos
              </p>
            </div>

            <div className="space-y-2">
              {comparisonData.changedSpans.map((span, i) => (
                <button
                  key={i}
                  onClick={() => handleSpanClick(span.start)}
                  className="w-full flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium">
                      {span.start.toFixed(1)}s - {span.end.toFixed(1)}s
                    </span>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    {(span.end - span.start).toFixed(1)}s changed
                  </Badge>
                </button>
              ))}
            </div>

            {comparisonData.overallSimilarity && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall Similarity:</span>
                  <span className="font-semibold">
                    {(comparisonData.overallSimilarity * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
