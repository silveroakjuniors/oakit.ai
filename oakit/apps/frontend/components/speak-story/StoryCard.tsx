"use client";

import Link from "next/link";

interface StoryCardProps {
  story: {
    id: string;
    title: string;
    ageGroup: string;
    imageUrl: string;
  };
}

export default function StoryCard({ story }: StoryCardProps) {
  return (
    <Link href={`/speak-story/player/${story.id}`}>
      <div className="bg-white rounded-3xl overflow-hidden shadow-lg hover:scale-105 transition cursor-pointer">
        <img
          src={story.imageUrl}
          alt={story.title}
          className="w-full h-52 object-cover"
        />

        <div className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              {story.title}
            </h2>

            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">
              {story.ageGroup}
            </span>
          </div>

          <button className="mt-4 w-full bg-purple-600 text-white py-3 rounded-2xl font-semibold hover:bg-purple-700">
            Listen Story
          </button>
        </div>
      </div>
    </Link>
  );
}