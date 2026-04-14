'use client';

import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { PRESET_THEMES, ThemeConfig, ColorPalette, generateColorPalette } from '@/lib/theme';
import { PremiumHeader, PremiumCard, PremiumButton, PremiumBadge } from '@/components/PremiumComponents';
import { Palette as PaletteIcon, Save, Copy } from 'lucide-react';

export default function AdminSettingsThemePage() {
  const { theme, palette, setTheme } = useTheme();
  const [customColor, setCustomColor] = useState(theme.primaryColor);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  const handlePresetTheme = async (presetTheme: ThemeConfig) => {
    setSaving(true);
    await setTheme(presetTheme);
    setCustomColor(presetTheme.primaryColor);
    setSavedMessage(`Theme changed to ${presetTheme.name}!`);
    setTimeout(() => setSavedMessage(''), 3000);
    setSaving(false);
  };

  const handleCustomColor = async () => {
    if (!/^#[0-9A-F]{6}$/i.test(customColor)) {
      setSavedMessage('Invalid hex color');
      return;
    }
    setSaving(true);
    const newTheme: ThemeConfig = {
      primaryColor: customColor,
      name: 'Custom',
    };
    await setTheme(newTheme);
    setSavedMessage('Custom theme saved!');
    setTimeout(() => setSavedMessage(''), 3000);
    setSaving(false);
  };

  const previewPalette = generateColorPalette(customColor);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-100">
      <PremiumHeader 
        title="Theme Settings"
        subtitle="Customize brand colors for your platform"
        icon="🎨"
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl mx-auto space-y-6">
        
        {/* Current Theme */}
        <PremiumCard>
          <div className="p-4 sm:p-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Current Theme</h2>
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 rounded-2xl shadow-lg"
                style={{ backgroundColor: palette.primary }}
              />
              <div>
                <p className="text-sm font-semibold text-neutral-700">{theme.name}</p>
                <p className="text-xs text-neutral-500 font-mono mt-1">{palette.primary}</p>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(palette.primary);
                    setSavedMessage('Color copied!');
                    setTimeout(() => setSavedMessage(''), 2000);
                  }}
                  className="text-xs text-blue-600 hover:underline mt-1 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
            </div>
          </div>
        </PremiumCard>

        {/* Preset Themes */}
        <PremiumCard>
          <div className="p-4 sm:p-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Preset Themes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(PRESET_THEMES).map(([key, themeConfig]) => {
                const themePalette = generateColorPalette(themeConfig.primaryColor);
                return (
                  <button
                    key={key}
                    onClick={() => handlePresetTheme(themeConfig)}
                    className="group relative rounded-xl overflow-hidden border-2 transition-all hover:shadow-lg active:scale-95"
                    style={
                      theme.primaryColor === themeConfig.primaryColor
                        ? { borderColor: themeConfig.primaryColor }
                        : { borderColor: '#E5E7EB' }
                    }
                  >
                    <div 
                      className="h-20 w-full"
                      style={{ backgroundColor: themePalette.primary }}
                    />
                    <div className="p-2 text-center">
                      <p className="text-xs font-semibold text-neutral-700">{themeConfig.name}</p>
                      {theme.primaryColor === themeConfig.primaryColor && (
                        <PremiumBadge label="Active" variant="primary" size="sm" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </PremiumCard>

        {/* Custom Color Picker */}
        <PremiumCard>
          <div className="p-4 sm:p-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Custom Color</h2>
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-neutral-600 block mb-2">
                    Enter hex color code
                  </label>
                  <input
                    type="text"
                    value={customColor}
                    onChange={e => setCustomColor(e.target.value.toUpperCase())}
                    placeholder="#1F5636"
                    className="w-full px-4 py-2 border border-neutral-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2"
                    style={{ focusRingColor: palette.primary }}
                  />
                </div>
                <input
                  type="color"
                  value={customColor}
                  onChange={e => setCustomColor(e.target.value.toUpperCase())}
                  className="w-12 h-10 rounded cursor-pointer border border-neutral-200"
                />
              </div>

              {/* Color Preview */}
              {customColor !== theme.primaryColor && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-neutral-50 rounded-lg">
                  <div className="text-center">
                    <div 
                      className="h-12 rounded-lg mb-2"
                      style={{ backgroundColor: previewPalette.primary }}
                    />
                    <p className="text-xs text-neutral-600">Primary</p>
                  </div>
                  <div className="text-center">
                    <div 
                      className="h-12 rounded-lg mb-2"
                      style={{ backgroundColor: previewPalette.primaryLight }}
                    />
                    <p className="text-xs text-neutral-600">Light</p>
                  </div>
                  <div className="text-center">
                    <div 
                      className="h-12 rounded-lg mb-2"
                      style={{ backgroundColor: previewPalette.primaryLighter }}
                    />
                    <p className="text-xs text-neutral-600">Lighter</p>
                  </div>
                </div>
              )}

              <PremiumButton 
                variant="primary"
                size="lg"
                onClick={handleCustomColor}
                disabled={saving || customColor === theme.primaryColor}
                icon={<Save className="w-4 h-4" />}
                className="w-full"
              >
                {saving ? 'Saving...' : 'Apply Custom Color'}
              </PremiumButton>
            </div>
          </div>
        </PremiumCard>

        {/* Color Palette Preview */}
        <PremiumCard>
          <div className="p-4 sm:p-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Complete Palette</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Primary', color: palette.primary },
                { label: 'Primary Light', color: palette.primaryLight },
                { label: 'Primary Lighter', color: palette.primaryLighter },
                { label: 'Primary Lightest', color: palette.primaryLightest },
                { label: 'Secondary', color: palette.secondary },
                { label: 'Success', color: palette.success },
                { label: 'Warning', color: palette.warning },
                { label: 'Error', color: palette.error },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-lg shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-neutral-700">{label}</p>
                    <p className="text-xs text-neutral-500 font-mono">{color}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PremiumCard>

        {/* Save Message */}
        {savedMessage && (
          <div className="fixed bottom-4 right-4 px-4 py-3 bg-emerald-600 text-white rounded-lg shadow-lg text-sm font-semibold animate-slide-up">
            ✓ {savedMessage}
          </div>
        )}
      </div>
    </div>
  );
}
