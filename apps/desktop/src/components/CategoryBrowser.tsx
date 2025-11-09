import { useState } from 'react';

type CategoryType = 'all' | 'movies' | 'series' | 'live' | 'favorites' | 'recent';

interface CategoryBrowserProps {
  onCategoryChange: (category: CategoryType) => void;
  currentCategory: CategoryType;
}

const categories = [
  { id: 'all' as CategoryType, name: 'All', icon: '🎬' },
  { id: 'movies' as CategoryType, name: 'Movies', icon: '🎥' },
  { id: 'series' as CategoryType, name: 'TV Shows', icon: '📺' },
  { id: 'live' as CategoryType, name: 'Live', icon: '📡' },
  { id: 'favorites' as CategoryType, name: 'Favorites', icon: '⭐' },
  { id: 'recent' as CategoryType, name: 'Recent', icon: '🕐' },
];

export function CategoryBrowser({
  onCategoryChange,
  currentCategory,
}: CategoryBrowserProps) {
  return (
    <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Categories
        </h2>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg
                       transition-colors mb-1 ${
                         currentCategory === category.id
                           ? 'bg-blue-600 text-white'
                           : 'text-gray-300 hover:bg-gray-700'
                       }`}
          >
            <span className="text-xl">{category.icon}</span>
            <span className="font-medium">{category.name}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="text-xs text-gray-500 space-y-1">
          <p>Keyboard Shortcuts:</p>
          <div className="space-y-0.5 font-mono">
            <p><kbd className="px-1 bg-gray-700 rounded">Space</kbd> Play/Pause</p>
            <p><kbd className="px-1 bg-gray-700 rounded">F</kbd> Fullscreen</p>
            <p><kbd className="px-1 bg-gray-700 rounded">M</kbd> Mute</p>
            <p><kbd className="px-1 bg-gray-700 rounded">←/→</kbd> Skip ±10s</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
