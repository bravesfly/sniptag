"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CLOUDFLARE_AI_PROVIDER, AIConfig, DEFAULT_AI_CONFIG, TextGenerationModel } from "@/lib/ai-providers";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";

export default function SettingsPage() {
  const [aiConfig, setAiConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [loading, setLoading] = useState(false);

  // Load settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/ai');
      if (response.ok) {
        const config = await response.json() as Partial<AIConfig>;
        // Ensure loaded config has a valid model, otherwise fallback to default
        const modelExists = CLOUDFLARE_AI_PROVIDER.models.some(m => m.id === config.model);
        if (config.model && !modelExists) {
          config.model = DEFAULT_AI_CONFIG.model;
        }
        setAiConfig({ ...DEFAULT_AI_CONFIG, ...config });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(aiConfig),
      });

      if (response.ok) {
        toast.success("Settings saved", {
          description: "AI configuration has been updated successfully."
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      toast.error("Failed to save", {
        description: "Please check your network connection and try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedModel = CLOUDFLARE_AI_PROVIDER.models.find(m => m.id === aiConfig.model);

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure AI analysis for automatic bookmark summaries and tags.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🤖 AI Configuration
          </CardTitle>
          <CardDescription>
            Select a Cloudflare AI model to analyze web content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Model selection */}
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select
              value={aiConfig.model}
              onValueChange={(value: string) => setAiConfig({ ...aiConfig, model: value as TextGenerationModel })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {CLOUDFLARE_AI_PROVIDER.models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span>{model.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {model.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Advanced settings */}
          <Separator />
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Advanced Settings</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature (0-1)</Label>
                <Input
                  id="temperature"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={aiConfig.temperature}
                  onChange={(e) => setAiConfig({
                    ...aiConfig,
                    temperature: parseFloat(e.target.value)
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Controls randomness. 0 is deterministic, 1 is most random.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  min="100"
                  max={selectedModel?.maxTokens || 8192}
                  value={aiConfig.maxTokens}
                  onChange={(e) => setAiConfig({
                    ...aiConfig,
                    maxTokens: parseInt(e.target.value)
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Max tokens for a single request.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={saveSettings}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Save size={16} />
              {loading ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}