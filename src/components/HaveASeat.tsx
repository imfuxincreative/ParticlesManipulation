import { useSimulation } from "@/context/SimulationContext"

export default function HaveASeat() {
    const { settings } = useSimulation()
    return <div className="h-screen w-screen bg-black/10 fixed top-0 left-0">
        <h1 className="fixed top-26 left-1/2  -translate-x-1/2 -translate-y-1/2">Have a Seat, Let's talk</h1>
        <div className="footer w-full fixed  px-6 bottom-20 z-[999]">
            <div className="actions w-full items-center justify-center flex  gap-3">
                <button className="border " style={{ borderColor: settings.xrayBorderColor, color: settings.xrayBorderColor, }}>Let's  talk</button>
                <button className="border " style={{ borderColor: settings.xrayBorderColor, color: settings.xrayBorderColor, }}>Play Chess</button>
            </div>

        </div>
    </div>
}