import "./catalog.css";
import { useState } from "react";

// UI Primitives - 相対パスでインポート（カタログはパッケージ内部なので）
import { Button } from "../src/ui/button";
import { Input } from "../src/ui/input";
import { Textarea } from "../src/ui/textarea";
import { Label } from "../src/ui/label";
import { Checkbox } from "../src/ui/checkbox";
import { Switch } from "../src/ui/switch";
import { RadioGroup, RadioGroupItem } from "../src/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../src/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../src/ui/card";
import { Alert, AlertDescription, AlertTitle } from "../src/ui/alert";
import { Badge } from "../src/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../src/ui/avatar";
import { Skeleton } from "../src/ui/skeleton";
import { Progress } from "../src/ui/progress";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../src/ui/table";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../src/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../src/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../src/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../src/ui/dropdown-menu";
import { Separator } from "../src/ui/separator";
import { ScrollArea } from "../src/ui/scroll-area";
import { AlertCircle, Terminal, Sun, Moon, ChevronRight } from "lucide-react";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-4">
      <h2 className="text-xl font-semibold border-b pb-2">{title}</h2>
      {children}
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function Catalog() {
  const [isDark, setIsDark] = useState(false);

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="container mx-auto flex items-center justify-between px-6 py-4">
            <h1 className="text-lg font-bold">@repo/admin-ui Component Catalog</h1>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsDark(!isDark)}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <nav className="sticky top-[65px] z-40 border-b bg-background/95 backdrop-blur">
          <div className="container mx-auto px-6 py-2">
            <ScrollArea className="w-full">
              <div className="flex gap-4 text-sm">
                {[
                  "buttons",
                  "inputs",
                  "cards",
                  "data-display",
                  "feedback",
                  "navigation",
                  "overlay",
                ].map((id) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="text-muted-foreground hover:text-foreground whitespace-nowrap"
                  >
                    {id}
                  </a>
                ))}
              </div>
            </ScrollArea>
          </div>
        </nav>

        <main className="container mx-auto space-y-12 px-6 py-8">
          {/* Buttons Section */}
          <Section id="buttons" title="Buttons">
            <SubSection title="Variants">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </SubSection>
            <SubSection title="Sizes">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon"><ChevronRight className="h-4 w-4" /></Button>
            </SubSection>
            <SubSection title="States">
              <Button disabled>Disabled</Button>
            </SubSection>
          </Section>

          {/* Inputs & Forms Section */}
          <Section id="inputs" title="Inputs & Forms">
            <SubSection title="Input">
              <Input placeholder="Default input" className="max-w-xs" />
              <Input disabled placeholder="Disabled" className="max-w-xs" />
            </SubSection>
            <SubSection title="Textarea">
              <Textarea placeholder="Enter text..." className="max-w-sm" />
            </SubSection>
            <SubSection title="Label + Input">
              <div className="grid w-full max-w-sm gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input type="email" id="email" placeholder="Email" />
              </div>
            </SubSection>
            <SubSection title="Checkbox">
              <div className="flex items-center space-x-2">
                <Checkbox id="terms" />
                <Label htmlFor="terms">Accept terms</Label>
              </div>
            </SubSection>
            <SubSection title="Switch">
              <div className="flex items-center space-x-2">
                <Switch id="mode" />
                <Label htmlFor="mode">Toggle mode</Label>
              </div>
            </SubSection>
            <SubSection title="Radio Group">
              <RadioGroup defaultValue="option-1">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="option-1" id="option-1" />
                  <Label htmlFor="option-1">Option 1</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="option-2" id="option-2" />
                  <Label htmlFor="option-2">Option 2</Label>
                </div>
              </RadioGroup>
            </SubSection>
            <SubSection title="Select">
              <Select>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Option 1</SelectItem>
                  <SelectItem value="2">Option 2</SelectItem>
                  <SelectItem value="3">Option 3</SelectItem>
                </SelectContent>
              </Select>
            </SubSection>
          </Section>

          {/* Cards & Containers Section */}
          <Section id="cards" title="Cards & Containers">
            <SubSection title="Card">
              <Card className="w-[350px]">
                <CardHeader>
                  <CardTitle>Card Title</CardTitle>
                  <CardDescription>Card description text</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Card content goes here.</p>
                </CardContent>
                <CardFooter>
                  <Button>Action</Button>
                </CardFooter>
              </Card>
            </SubSection>
            <SubSection title="Alert">
              <div className="space-y-3 w-full max-w-md">
                <Alert>
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Default Alert</AlertTitle>
                  <AlertDescription>This is a default alert.</AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>Something went wrong.</AlertDescription>
                </Alert>
              </div>
            </SubSection>
            <SubSection title="Separator">
              <div className="w-full max-w-md space-y-1">
                <p className="text-sm">Above</p>
                <Separator />
                <p className="text-sm">Below</p>
              </div>
            </SubSection>
          </Section>

          {/* Data Display Section */}
          <Section id="data-display" title="Data Display">
            <SubSection title="Badge">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </SubSection>
            <SubSection title="Avatar">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>AB</AvatarFallback>
              </Avatar>
            </SubSection>
            <SubSection title="Skeleton">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </div>
            </SubSection>
            <SubSection title="Progress">
              <Progress value={60} className="w-[300px]" />
            </SubSection>
            <SubSection title="Table">
              <Table>
                <TableCaption>Sample data</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Alice</TableCell>
                    <TableCell>Active</TableCell>
                    <TableCell className="text-right">$250.00</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Bob</TableCell>
                    <TableCell>Pending</TableCell>
                    <TableCell className="text-right">$150.00</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </SubSection>
          </Section>

          {/* Navigation Section */}
          <Section id="navigation" title="Navigation">
            <SubSection title="Breadcrumb">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/">Home</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Settings</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </SubSection>
            <SubSection title="Tabs">
              <Tabs defaultValue="tab1" className="w-[400px]">
                <TabsList>
                  <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                  <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                  <TabsTrigger value="tab3">Tab 3</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1">Content for tab 1</TabsContent>
                <TabsContent value="tab2">Content for tab 2</TabsContent>
                <TabsContent value="tab3">Content for tab 3</TabsContent>
              </Tabs>
            </SubSection>
          </Section>

          {/* Overlay Section */}
          <Section id="overlay" title="Overlay">
            <SubSection title="Tooltip">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline">Hover me</Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Tooltip content</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </SubSection>
            <SubSection title="Popover">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Open Popover</Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="grid gap-4">
                    <h4 className="font-medium leading-none">Popover Title</h4>
                    <p className="text-sm text-muted-foreground">Popover content here.</p>
                  </div>
                </PopoverContent>
              </Popover>
            </SubSection>
            <SubSection title="Dropdown Menu">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Open Menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem>Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SubSection>
          </Section>
        </main>

        <footer className="border-t py-6 text-center text-sm text-muted-foreground">
          @repo/admin-ui Component Catalog
        </footer>
      </div>
    </div>
  );
}
