"use client";
import Loading from '@/app/components/shared/Loading/Loading';
import { Tab, Tabs } from '@nextui-org/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { FaArrowLeft } from 'react-icons/fa6';
import dynamic from 'next/dynamic';
import { RxCheck, RxCross2 } from 'react-icons/rx';
import Image from 'next/image';
import { MdOutlineFileUpload } from 'react-icons/md';
import { FiSave } from 'react-icons/fi';
import { isValidImageFile } from '@/app/components/shared/upload/isValidImageFile';
import { useSession } from 'next-auth/react';
import { useAxiosSecure } from '@/app/hooks/useAxiosSecure';

const Editor = dynamic(() => import('@/app/utils/Editor/Editor'), { ssr: false });

const EditPromo = () => {

  const { id } = useParams();
  const axiosSecure = useAxiosSecure();
  const router = useRouter();
  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promoDiscountType, setPromoDiscountType] = useState('Percentage');
  const [expiryDate, setExpiryDate] = useState(''); // Initial state set to an empty string
  const [promoDescription, setPromoDescription] = useState("");
  const [image, setImage] = useState(null);
  const [dateError, setDateError] = useState(false);
  const { data: session, status } = useSession();

  const handleTabChange = (key) => {
    setPromoDiscountType(key);
    setValue('maxAmount', '');
  };

  // Format date to yyyy-mm-dd for date input field
  const formatDateForInput = (dateStr) => {
    const date = new Date(dateStr);
    const day = (`0${date.getDate()}`).slice(-2);
    const month = (`0${date.getMonth() + 1}`).slice(-2);
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (!id || typeof window === "undefined") return;

    if (status !== "authenticated" || !session?.user?.accessToken) return;

    const fetchPromoCode = async () => {
      try {
        const response = await axiosSecure.get(`/getSinglePromo/${id}`);
        const promo = response.data;

        // Ensure the expiry date is set to midnight to avoid timezone issues
        const fetchedExpiryDate = formatDateForInput(promo.expiryDate);

        // Set form fields with fetched promo data
        setValue('promoCode', promo?.promoCode);
        setValue('promoDiscountValue', promo?.promoDiscountValue);
        setExpiryDate(fetchedExpiryDate); // Ensure no time zone shift
        setValue('maxAmount', promo?.maxAmount || 0);
        setValue('minAmount', promo?.minAmount || 0);

        setPromoDiscountType(promo?.promoDiscountType);
        setPromoDescription(promo?.promoDescription || "");
        setImage(promo?.imageUrl || null);
        setIsLoading(false);
      } catch (err) {
        // console.error(err); // Log error to the console for debugging
        // toast.error("Failed to fetch promo code details!");
        router.push('/marketing');
      }
    };

    fetchPromoCode();
  }, [id, axiosSecure, setValue, session?.user?.accessToken, status, router]);

  const uploadSingleFileToGCS = async (image) => {
    try {
      const formData = new FormData();
      formData.append('attachment', image);

      const response = await axiosSecure.post('/upload-single-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      if (response?.data?.fileUrl) {
        return response.data.fileUrl;
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleImageChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!isValidImageFile(file)) return;

    // Immediately upload the selected image to Imgbb
    const uploadedImageUrl = await uploadSingleFileToGCS(file);

    if (uploadedImageUrl) {
      // Update the state with the Imgbb URL instead of the local blob URL
      setImage(uploadedImageUrl);
    }
  };

  const handleImageRemove = () => {
    setImage(null);
    document.getElementById('imageUpload').value = ''; // Clear the file input
  };

  const onSubmit = async (data) => {
    const { promoCode, promoDiscountValue, maxAmount, minAmount } = data;

    let hasError = false;

    if (!expiryDate) {
      setDateError(true);
      hasError = true;
    } else {
      setDateError(false);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedExpiryDate = new Date(expiryDate);

      if (selectedExpiryDate < today) {
        toast.error("Expiry date cannot be in the past.");
        hasError = true;
      }
    }

    if (hasError) {
      return;
    }

    setIsSubmitting(true);

    try {
      const updatedDiscount = {
        promoCode: promoCode.toUpperCase(),
        promoDiscountValue,
        promoDiscountType,
        expiryDate,
        maxAmount: maxAmount || 0,
        minAmount: minAmount || 0,
        promoDescription,
        imageUrl: image === null ? "" : image,
      };

      const res = await axiosSecure.put(`/updatePromo/${id}`, updatedDiscount);
      if (res.data.modifiedCount > 0) {
        toast.custom((t) => (
          <div
            className={`${t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex items-center ring-1 ring-black ring-opacity-5`}
          >
            <div className="pl-6">
              <RxCheck className="h-6 w-6 bg-green-500 text-white rounded-full" />
            </div>
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="ml-3 flex-1">
                  <p className="text-base font-bold text-gray-900">
                    Promo Updated!
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    The promo has been successfully updated!
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-200">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center font-medium text-red-500 hover:text-text-700 focus:outline-none text-2xl"
              >
                <RxCross2 />
              </button>
            </div>
          </div>
        ), {
          position: "bottom-right",
          duration: 5000
        })
        router.push('/marketing');
      } else {
        toast.error('No changes detected.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error editing promo:', error);
      toast.error('Failed to update promo. Please try again!');
      setIsSubmitting(false);
    }
  };

  if (isLoading || status === "loading") {
    return <Loading />;
  }

  return (
    <div className='bg-gray-50 min-h-screen'>

      <div className='max-w-screen-2xl px-6 mx-auto'>

        <div className='max-w-screen-xl mx-auto pt-3 sticky top-0 z-10 bg-gray-50'>
          <div className='flex items-center justify-between'>
            <h3 className='w-full font-semibold text-lg md:text-xl lg:text-2xl'>Edit Promo Configuration</h3>
            <Link className='flex items-center gap-2 text-[10px] md:text-base justify-end w-full' href={"/marketing"}> <span className='border border-black hover:scale-105 duration-300 rounded-full p-1 md:p-2'><FaArrowLeft /></span> Go Back</Link>
          </div>
        </div>

        {/* Your form code */}
        <form onSubmit={handleSubmit(onSubmit)} className='max-w-screen-xl mx-auto pt-1 pb-6 flex flex-col gap-6'>

          <div className='grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-6'>
            <div className='grid grid-cols-1 lg:col-span-7 xl:col-span-7 gap-8 mt-3 py-3 h-fit'>
              <div className='flex flex-col gap-4 bg-[#ffffff] drop-shadow p-5 md:p-7 rounded-lg h-fit'>
                <div>
                  <label htmlFor='promoCode' className='flex justify-start font-medium text-[#9F5216]'>Promo Code *</label>
                  <input id='promoCode' {...register("promoCode", { required: true })} className="w-full p-3 border border-gray-300 outline-none focus:border-[#9F5216] transition-colors duration-1000 rounded-md uppercase" type="text" />
                  {errors.promoCode?.type === "required" && (
                    <p className="text-red-600 text-left">Promo Code is required</p>
                  )}
                </div>

                <div className="flex w-full flex-col">
                  <Tabs
                    aria-label="Select Discount Type"
                    selectedKey={promoDiscountType} // Default select based on fetched data
                    onSelectionChange={handleTabChange}
                  >
                    <Tab key="Percentage" title="Percentage">Percentage (%)</Tab>
                    <Tab key="Amount" title="Amount">Amount (Taka)</Tab>
                  </Tabs>

                  <input
                    type="number"
                    {...register('promoDiscountValue', { required: true })}
                    className='custom-number-input w-full p-3 border rounded-md border-gray-300 outline-none focus:border-[#9F5216] transition-colors duration-1000'
                    placeholder={`Enter ${promoDiscountType} Discount`} // Correct placeholder
                  />
                  {errors.promoDiscountValue?.type === "required" && (
                    <p className="text-red-600 text-left">Discount Value is required</p>
                  )}
                </div>
              </div>

              <div className='flex flex-col gap-4 bg-[#ffffff] drop-shadow p-5 md:p-7 rounded-lg h-fit'>

                <div>
                  <label htmlFor='minAmount' className='flex justify-start font-medium text-[#9F5216]'>Minimum Order Amount *</label>
                  <input id='minAmount' {...register("minAmount", { required: true })} placeholder='Enter Minimum Order Amount' className="custom-number-input w-full p-3 border border-gray-300 outline-none focus:border-[#9F5216] transition-colors duration-1000 rounded-md" type="number" />
                  {errors.minAmount?.type === "required" && (
                    <p className="text-red-600 text-left">Min Amount is required</p>
                  )}
                </div>

                {promoDiscountType === "Percentage" && <div>
                  <label htmlFor='maxAmount' className='flex justify-start font-medium text-[#9F5216]'>Maximum Capped Amount *</label>
                  <input id='maxAmount' {...register("maxAmount", { required: true })} placeholder='Enter Maximum Capped Amount' className="custom-number-input w-full p-3 border border-gray-300 outline-none focus:border-[#9F5216] transition-colors duration-1000 rounded-md" type="number" />
                  {errors.maxAmount?.type === "required" && (
                    <p className="text-red-600 text-left">Max Amount is required</p>
                  )}
                </div>}

                <div className="space-y-2">
                  <label htmlFor='expiryDate' className='block text-[#9F5216] font-medium text-sm'>
                    Expiry Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    id="expiryDate"
                    {...register("expiryDate", { required: true })}
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)} // Update state with the input value
                    className="w-full p-3 border rounded-md border-gray-300 outline-none focus:border-[#9F5216] transition-colors duration-1000"
                  />
                  {errors.expiryDate?.type === "required" && (
                    <p className="text-red-600 text-sm mt-1">Expiry Date is required</p>
                  )}
                </div>
              </div>
            </div>

            <div className='grid grid-cols-1 lg:col-span-5 xl:col-span-5 gap-8 mt-3 py-3'>

              <div className='flex flex-col gap-6 bg-[#ffffff] drop-shadow p-5 md:p-7 rounded-lg'>

                <div className='flex w-full flex-col gap-2'>
                  <label htmlFor='promoDescription' className='flex justify-start font-medium text-[#9F5216] pb-2'>Offer Description</label>
                  <Controller
                    control={control}
                    name="promoDescription"
                    render={({ field }) => (
                      <Editor
                        {...field}
                        value={promoDescription}
                        onChange={setPromoDescription}
                      />
                    )}
                  />
                </div>

                <div className='flex flex-col gap-4'>
                  <input
                    id='imageUpload'
                    type='file'
                    className='hidden'
                    onChange={handleImageChange}
                  />
                  <label
                    htmlFor='imageUpload'
                    className='mx-auto flex flex-col items-center justify-center space-y-3 rounded-lg border-2 border-dashed border-gray-400 p-6 bg-white cursor-pointer'
                  >
                    <MdOutlineFileUpload size={60} />
                    <div className='space-y-1.5 text-center'>
                      <h5 className='whitespace-nowrap text-lg font-medium tracking-tight'>
                        Upload Thumbnail
                      </h5>
                      <p className='text-sm text-gray-500'>
                        Photo Should be in PNG, JPEG or JPG format
                      </p>
                    </div>
                  </label>

                  {image && (
                    <div className='relative'>
                      <Image
                        src={image}
                        alt='Uploaded image'
                        height={3000}
                        width={3000}
                        className='w-full min-h-[200px] max-h-[200px] rounded-md object-contain'
                      />
                      <button
                        onClick={handleImageRemove}
                        className='absolute top-1 right-1 rounded-full p-1 bg-red-600 hover:bg-red-700 text-white font-bold'
                      >
                        <RxCross2 size={24} />
                      </button>
                    </div>
                  )}

                </div>

              </div>

            </div>

          </div>

          <div className='flex justify-end items-center'>

            <button
              type='submit'
              disabled={isSubmitting}
              className={`${isSubmitting ? 'bg-gray-400' : 'bg-[#ffddc2] hover:bg-[#fbcfb0]'} relative z-[1] flex items-center gap-x-3 rounded-lg  px-[15px] py-2.5 transition-[background-color] duration-300 ease-in-out font-bold text-[14px] text-neutral-700`}
            >
              {isSubmitting ? 'Saving...' : 'Save'} <FiSave size={20} />
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};

export default EditPromo;