'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Recycle, 
  MapPin, 
  BarChart3, 
  HelpCircle,
  CheckCircle,
  Layers
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-12 py-4">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto space-y-6 pt-6">
        <div className="inline-flex items-center space-x-2 bg-forest-100 text-forest-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-forest-200">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Bengaluru Circular Economy Pilot (Karnataka, India)</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-forest-950 leading-tight">
          Give every unwanted item a second life in Bengaluru.
        </h1>

        <p className="text-lg text-gray-700 leading-relaxed font-normal">
          Combine photo assessment powered by <strong>Gemini on Vertex AI</strong> with{' '}
          <strong>BBMP waste segregation rules</strong>, <strong>local DWCC recycling hubs</strong>, and{' '}
          <strong>real neighbourhood community reuse listings</strong>.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/assess"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-forest-700 hover:bg-forest-800 text-white font-semibold px-7 py-3.5 rounded-xl shadow-md transition transform hover:-translate-y-0.5"
          >
            <Sparkles className="w-5 h-5" />
            <span>Assess an Item Now</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/listings"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-white hover:bg-forest-50/80 text-forest-900 border border-warm-300 font-semibold px-6 py-3.5 rounded-xl transition"
          >
            <Recycle className="w-4 h-4 text-forest-700" />
            <span>Browse Community Reuse</span>
          </Link>
        </div>
      </section>

      {/* Architecture / Integrity Highlights */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
        <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-forest-100 flex items-center justify-center text-forest-800">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Evidence Grounding</h2>
          <p className="text-sm text-gray-600 leading-normal">
            No AI hallucinations. Gemini explains eligible actions strictly using deterministic backend evidence filtered from verified local rules and curated non-profit records.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-forest-100 flex items-center justify-center text-forest-800">
            <Recycle className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Circular Hierarchy</h2>
          <p className="text-sm text-gray-600 leading-normal">
            Prioritizes high-value circularity: Repair &gt; Reuse &gt; Donate &gt; Recycle &gt; Safe Disposal. ReLoop asks clarifying condition questions before suggesting actions.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-forest-100 flex items-center justify-center text-forest-800">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Verifiable Analytics</h2>
          <p className="text-sm text-gray-600 leading-normal">
            Uses an outbox pattern with Pub/Sub and BigQuery. Aggregates completed diversion in kg while cleanly isolating demo and test interactions.
          </p>
        </div>
      </section>

      {/* Labeled Sample Walkthrough */}
      <section className="bg-forest-900 text-white rounded-3xl p-8 sm:p-10 shadow-lg space-y-8">
        <div>
          <div className="inline-block bg-forest-800 text-forest-200 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
            Interactive User Flow
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Sample Item Assessment Walkthrough
          </h2>
          <p className="text-forest-200 text-sm mt-1 max-w-2xl">
            See how an everyday item moves through AI assessment, condition verification, local evidence matching, and completion recording.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-forest-800/80 p-5 rounded-2xl border border-forest-700/60 space-y-2">
            <div className="w-7 h-7 rounded-full bg-forest-600 text-white flex items-center justify-center text-xs font-bold">1</div>
            <h3 className="font-semibold text-sm text-white">Upload or Describe</h3>
            <p className="text-xs text-forest-200">
              User takes a photo of a wooden dining chair with a loose leg or enters a text description.
            </p>
          </div>

          <div className="bg-forest-800/80 p-5 rounded-2xl border border-forest-700/60 space-y-2">
            <div className="w-7 h-7 rounded-full bg-forest-600 text-white flex items-center justify-center text-xs font-bold">2</div>
            <h3 className="font-semibold text-sm text-white">Gemini Assessment</h3>
            <p className="text-xs text-forest-200">
              Gemini detects furniture &amp; wood, asking: <em>&ldquo;Is it structurally sound or does it wobble?&rdquo;</em>
            </p>
          </div>

          <div className="bg-forest-800/80 p-5 rounded-2xl border border-forest-700/60 space-y-2">
            <div className="w-7 h-7 rounded-full bg-forest-600 text-white flex items-center justify-center text-xs font-bold">3</div>
            <h3 className="font-semibold text-sm text-white">Verified Matching</h3>
            <p className="text-xs text-forest-200">
              Matches Repair Café Bengaluru, Hasiru Dala DWCC, and BBMP bulky waste protocols.
            </p>
          </div>

          <div className="bg-forest-800/80 p-5 rounded-2xl border border-forest-700/60 space-y-2">
            <div className="w-7 h-7 rounded-full bg-forest-600 text-white flex items-center justify-center text-xs font-bold">4</div>
            <h3 className="font-semibold text-sm text-white">Record Diversion</h3>
            <p className="text-xs text-forest-200">
              User completes the repair, enters 6.5 kg diverted, and updates community analytics.
            </p>
          </div>
        </div>

        <div className="pt-2 text-center">
          <Link
            href="/assess?sample=furniture"
            className="inline-flex items-center space-x-2 bg-white text-forest-900 font-semibold px-6 py-3 rounded-xl hover:bg-forest-50 transition shadow-sm text-sm"
          >
            <span>Try Sample Chair Walkthrough</span>
            <ArrowRight className="w-4 h-4 text-forest-800" />
          </Link>
        </div>
      </section>
    </div>
  );
}
