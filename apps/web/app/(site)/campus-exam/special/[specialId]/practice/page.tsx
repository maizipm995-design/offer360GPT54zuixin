'use client';

import { useParams } from 'next/navigation';
import CampusExamPracticeClient from '@/components/campus-exam/campus-exam-practice-client';

export default function CampusExamPracticePage() {
  const params = useParams<{ specialId: string }>();
  return <CampusExamPracticeClient specialId={Number(params.specialId)} />;
}
