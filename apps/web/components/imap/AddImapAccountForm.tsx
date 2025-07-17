"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/Input";
import { toastSuccess, toastError } from "@/components/Toast";
import { IMAP_PROVIDERS } from "@/utils/providers/imap";

interface AddImapAccountFormProps {
  onSuccess?: () => void;
}

export function AddImapAccountForm({ onSuccess }: AddImapAccountFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    host: "imap.gemneye.org",
    port: 993,
    user: "",
    password: "",
    name: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // First test the connection
      const testResponse = await fetch("/api/test/imap-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!testResponse.ok) {
        const error = await testResponse.json();
        throw new Error(error.error || "Connection test failed");
      }

      // If connection test passes, create the account
      const createResponse = await fetch("/api/user/imap-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || "Failed to create account");
      }

      toastSuccess({
        title: "Success!",
        description: "IMAP account added successfully",
      });

      // Reset form
      setFormData({
        host: "imap.gemneye.org",
        port: 993,
        user: "",
        password: "",
        name: "",
      });

      onSuccess?.();
    } catch (error) {
      toastError({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add IMAP account",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetSelect = (preset: string) => {
    const provider = IMAP_PROVIDERS[preset as keyof typeof IMAP_PROVIDERS];
    if (provider) {
      setFormData(prev => ({
        ...prev,
        host: provider.host,
        port: provider.port,
        name: provider.name,
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Add IMAP Account</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Common Providers
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(IMAP_PROVIDERS).map(([key, provider]) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={() => handlePresetSelect(key)}
                type="button"
              >
                {provider.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="IMAP Server"
            type="text"
            value={formData.host}
            onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
            placeholder="imap.gemneye.org"
            required
          />
          <Input
            label="Port"
            type="number"
            value={formData.port}
            onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) }))}
            placeholder="993"
            required
          />
        </div>

        <Input
          label="Email Address"
          type="email"
          value={formData.user}
          onChange={(e) => setFormData(prev => ({ ...prev, user: e.target.value }))}
          placeholder="your-email@gemneye.org"
          required
        />

        <Input
          label="Password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
          placeholder="Your email password"
          required
        />

        <Input
          label="Account Name (Optional)"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="My Gemneye Account"
        />

        <Button type="submit" loading={isLoading} className="w-full">
          {isLoading ? "Testing Connection..." : "Add IMAP Account"}
        </Button>
      </form>
    </div>
  );
}