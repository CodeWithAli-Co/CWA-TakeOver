import NexusContractGenerator from '@/MyComponents/generateContractId'
import { createLazyFileRoute } from '@tanstack/react-router'


function ContractGen() {
  return <>
  <NexusContractGenerator />
  </>
}
export const Route = createLazyFileRoute('/contractGenerator')({
  component: ContractGen,
})
