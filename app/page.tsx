"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Key, CheckCircle2 } from "lucide-react";
import { useDocumentStore } from "@/store/useDocumentStore";
import { motion, AnimatePresence } from "framer-motion";

export default function SetupPage() {
  const router = useRouter();
  const setAuthenticated = useDocumentStore((state) => state.setAuthenticated);
  
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/validate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setAuthenticated(true);
        
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } else {
        setError(data.error || "Failed to validate token");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const isValidToken = token.length >= 10;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Key className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Document Verification</CardTitle>
            <CardDescription>
              Enter your Databricks Personal Access Token to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">Databricks Personal Access Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="dapi..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={isLoading || success}
                  className="font-mono"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Your token will be securely stored and never exposed to the client
                </p>
              </div>

              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-sm text-destructive bg-destructive/10 p-3 rounded-md"
                  >
                    {error}
                  </motion.div>
                )}

                {success && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Token validated! Redirecting...</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                className="w-full"
                disabled={!isValidToken || isLoading || success}
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : success ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Connected
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              <p>Need help? Check the Databricks documentation for</p>
              <p>instructions on generating a Personal Access Token</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
