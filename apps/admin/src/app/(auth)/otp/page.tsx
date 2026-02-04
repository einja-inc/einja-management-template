"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@repo/admin-ui/lib/utils";
import { Button } from "@repo/admin-ui/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/admin-ui/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/admin-ui/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@repo/admin-ui/ui/input-otp";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  otp: z.string().min(6, "Please enter the 6-digit code").max(6, "Please enter the 6-digit code"),
});

export default function OtpPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { otp: "" },
  });

  const otp = form.watch("otp");

  function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true);
    console.log("OTP Data:", data);

    setTimeout(() => {
      setIsLoading(false);
      alert(`OTP verified: ${data.otp}`);
      router.push("/");
    }, 1000);
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base tracking-tight">Two-factor Authentication</CardTitle>
        <CardDescription>
          Please enter the authentication code. <br /> We have sent the authentication code to your
          email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={cn("grid gap-2")}>
            <FormField
              control={form.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">One-Time Password</FormLabel>
                  <FormControl>
                    <InputOTP
                      maxLength={6}
                      {...field}
                      containerClassName="justify-between sm:[&>[data-slot='input-otp-group']>div]:w-12"
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button className="mt-2" disabled={otp.length < 6 || isLoading}>
              Verify
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter>
        <p className="px-8 text-center text-sm text-muted-foreground">
          Haven&apos;t received it?{" "}
          <Link href="/sign-in" className="underline underline-offset-4 hover:text-primary">
            Resend a new code
          </Link>
          .
        </p>
      </CardFooter>
    </Card>
  );
}
