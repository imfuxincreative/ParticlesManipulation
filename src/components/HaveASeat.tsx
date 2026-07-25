import { useSimulation } from "@/context/SimulationContext"
import { FaChessKnight } from "react-icons/fa"
import { GoArrowUpRight } from "react-icons/go"

export default function HaveASeat() {
    const { settings } = useSimulation()
    return <div className="h-screen w-screen bg-black/10 fixed top-0 left-0">
        <div>
            <div className="fixed top-26 left-1/2 flex flex-col  -translate-x-1/2 -translate-y-1/2">

                <span>Got a project on mind ?</span>
                <h1 className="">Have a Seat, Let's talk</h1>

            </div>
        </div>
        <div className="footer w-full fixed  px-2 lg:px-6 bottom-16 z-[999]">
            <div className="actions w-full items-center justify-center flex  gap-3">
                <button className="border flex items-center gap-1.5  " style={{ borderColor: settings.xrayBorderColor, color: settings.xrayBorderColor, backgroundColor: `${settings.xrayBorderColor}10`, }}>Follow </button>
                <button className="border flex items-center gap-1.5  " style={{ backgroundColor: `${settings.xrayBorderColor}10`, borderColor: settings.xrayBorderColor, color: settings.xrayBorderColor, }}>Challenge </button>
            </div>

            <div style={{ color: settings.xrayBorderColor }} className="flex w-full items-center mt-5 text-[13px] text-light justify-center gap-4">

                <a style={{ color: settings.xrayBorderColor }} href="/https://github.com/imfuxincreative">Instagram</a> |
                <a style={{ color: settings.xrayBorderColor }} href="/https://github.com/imfuxincreative">Behance</a> |
                <a style={{ color: settings.xrayBorderColor }} href="/https://github.com/imfuxincreative">Github</a> |
                <a style={{ color: settings.xrayBorderColor }} href="/https://github.com/imfuxincreative">LinkedIn</a>
            </div>

        </div>
    </div>
}