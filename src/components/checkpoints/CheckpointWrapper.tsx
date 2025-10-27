'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface CheckpointWrapperProps {
  title: string;
  description: string;
  children: React.ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  backLabel?: string;
}

export default function CheckpointWrapper({
  title,
  description,
  children,
  onNext,
  onBack,
  nextLabel = 'Save and Continue',
  backLabel = 'Back',
}: CheckpointWrapperProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl tracking-tight">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
      <CardFooter className="flex justify-between border-t px-6 py-4">
        {onBack ? (
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Button>
        ) : (
          <div />
        )}
        {onNext && (
          <Button onClick={onNext}>
            {nextLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
