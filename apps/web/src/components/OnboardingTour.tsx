'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, CheckCircle } from 'lucide-react';

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'compare',
    title: 'See What Changed',
    description: 'Compare any two versions to see exactly which time spans were edited. Advanced fingerprinting highlights changed segments.',
    icon: <CheckCircle className="h-5 w-5 text-blue-600" />,
  },
  {
    id: 'approve',
    title: 'Internal Approval',
    description: 'Team members approve versions with their role. All approvals are timestamped and cryptographically signed.',
    icon: <CheckCircle className="h-5 w-5 text-green-600" />,
  },
  {
    id: 'signoff',
    title: 'Client Sign-off',
    description: 'Send a secure link to your client. They can approve or request changes without creating an account.',
    icon: <CheckCircle className="h-5 w-5 text-purple-600" />,
  },
  {
    id: 'receipt',
    title: 'Export Verifiable Receipt',
    description: 'Generate a signed receipt with QR code. Download as PDF + JSON evidence pack. Anyone can verify authenticity.',
    icon: <CheckCircle className="h-5 w-5 text-amber-600" />,
  },
];

const TOUR_STORAGE_KEY = 'humanstamp_tour_completed';

export function OnboardingTour() {
  const [showTour, setShowTour] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      setShowTour(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setShowTour(false);
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDismiss();
    }
  };

  if (!showTour) {
    return null;
  }

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {step.icon}
              <div>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>
                  Step {currentStep + 1} of {TOUR_STEPS.length}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-6">
            {step.description}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i === currentStep
                      ? 'bg-primary'
                      : i < currentStep
                      ? 'bg-primary/40'
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleDismiss}>
                Skip Tour
              </Button>
              <Button onClick={handleNext} size="sm">
                {isLastStep ? 'Get Started' : 'Next'}
                {!isLastStep && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
