import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
	title: {
		default: "LinguaMentor — AI Exam-Grade Language Evaluation",
		template: "%s · LinguaMentor",
	},
	description:
		"AI-orchestrated language proficiency evaluation — rubric-calibrated writing scoring, real-time voice coaching, and readiness forecasting for IELTS, TOEFL, and DELF.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className={inter.variable}>
			<body className="min-h-screen font-sans">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
